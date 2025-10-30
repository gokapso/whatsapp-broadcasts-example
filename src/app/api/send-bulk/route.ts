import { NextResponse } from 'next/server';
import { whatsappClient, phoneNumberId } from '@/lib/whatsapp';
import { buildTemplatePayload } from '@kapso/whatsapp-cloud-api';
import type { BulkSendRequest, SendResult, Template } from '@/types';
import { normalizePhoneNumber } from '@/lib/csv-parser';

function buildComponentsFromParams(template: Template, params: string[]) {
  const components: any[] = [];
  let paramIndex = 0;

  // Extract HEADER parameters
  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  if (headerComponent?.format) {
    if (headerComponent.format === 'TEXT' && headerComponent.text) {
      // Match both positional {{1}} and named {{name}} parameters
      const headerMatches = headerComponent.text.match(/\{\{([^}]+)\}\}/g);
      if (headerMatches && headerMatches.length > 0) {
        const headerParams = params.slice(paramIndex, paramIndex + headerMatches.length);

        const parameters = headerMatches.map((match, i) => {
          const paramName = match.replace(/\{\{|\}\}/g, '');
          const isPositional = /^\d+$/.test(paramName);

          const param: any = {
            type: 'text',
            text: headerParams[i],
          };

          // Add parameter_name for named parameters
          if (!isPositional) {
            param.parameter_name = paramName;
          }

          return param;
        });

        paramIndex += headerMatches.length;

        components.push({
          type: 'header',
          parameters,
        });
      }
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
      // Media header - first param is URL or media ID
      if (paramIndex < params.length) {
        const mediaValue = params[paramIndex];
        paramIndex++;

        // Determine if it's a URL or media ID
        const isUrl = mediaValue.startsWith('http://') || mediaValue.startsWith('https://');

        components.push({
          type: 'header',
          parameters: [{
            type: headerComponent.format.toLowerCase(),
            [isUrl ? 'link' : 'id']: mediaValue,
          }],
        });
      }
    }
  }

  // Extract BODY parameters
  const bodyComponent = template.components?.find(c => c.type === 'BODY');
  if (bodyComponent?.text) {
    const bodyMatches = bodyComponent.text.match(/\{\{([^}]+)\}\}/g);
    if (bodyMatches && bodyMatches.length > 0) {
      const bodyParams = params.slice(paramIndex, paramIndex + bodyMatches.length);

      const parameters = bodyMatches.map((match, i) => {
        const paramName = match.replace(/\{\{|\}\}/g, '');
        const isPositional = /^\d+$/.test(paramName);

        const param: any = {
          type: 'text',
          text: bodyParams[i],
        };

        // Add parameter_name for named parameters
        if (!isPositional) {
          param.parameter_name = paramName;
        }

        return param;
      });

      paramIndex += bodyMatches.length;

      components.push({
        type: 'body',
        parameters,
      });
    }
  }

  // Extract URL BUTTON parameters
  const buttonsComponent = template.components?.find(c => c.type === 'BUTTONS');
  if (buttonsComponent?.buttons) {
    buttonsComponent.buttons.forEach((button: any, buttonIndex: number) => {
      if (button.type === 'URL' && button.url) {
        const urlMatch = button.url.match(/\{\{([^}]+)\}\}/);
        if (urlMatch && paramIndex < params.length) {
          const paramName = urlMatch[1];
          const isPositional = /^\d+$/.test(paramName);

          const param: any = {
            type: 'text',
            text: params[paramIndex],
          };

          // Add parameter_name for named parameters
          if (!isPositional) {
            param.parameter_name = paramName;
          }

          components.push({
            type: 'button',
            sub_type: 'url',
            index: buttonIndex,
            parameters: [param],
          });
          paramIndex++;
        }
      }
    });
  }

  return components;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkSendRequest;
    const { templateName, language, rows } = body;

    if (!templateName || !language || !rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: templateName, language, rows' },
        { status: 400 }
      );
    }

    // Fetch template to understand its structure
    const businessAccountId = process.env.BUSINESS_ACCOUNT_ID;
    if (!businessAccountId) {
      return NextResponse.json(
        { error: 'BUSINESS_ACCOUNT_ID not configured' },
        { status: 500 }
      );
    }

    const templatesResponse = await whatsappClient.templates.list({
      businessAccountId,
    });

    const template = templatesResponse.data.find(
      (t: Template) => t.name === templateName && t.language === language
    );

    if (!template) {
      return NextResponse.json(
        { error: `Template ${templateName} (${language}) not found` },
        { status: 404 }
      );
    }

    const results: SendResult[] = [];

    for (const row of rows) {
      try {
        const phone = normalizePhoneNumber(row.phoneNumber);

        // Build template payload with parameters mapped to correct components
        const components = row.params.length > 0
          ? buildComponentsFromParams(template, row.params)
          : [];

        // Use the new buildTemplatePayload that accepts raw Meta-style components
        const templatePayload = buildTemplatePayload({
          name: templateName,
          language,
          components,
        });

        const response = await whatsappClient.messages.sendTemplate({
          phoneNumberId,
          to: phone,
          template: templatePayload,
        });

        results.push({
          phoneNumber: row.phoneNumber,
          success: true,
          messageId: response.messages?.[0]?.id,
        });
      } catch (error) {
        console.error(`Error sending to ${row.phoneNumber}:`, error);
        results.push({
          phoneNumber: row.phoneNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      totalSent: results.length,
      successful: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error('Error in bulk send:', error);
    return NextResponse.json(
      { error: 'Failed to send messages' },
      { status: 500 }
    );
  }
}
