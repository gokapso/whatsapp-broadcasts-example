'use client';

import { useState, useEffect } from 'react';
import type { Template, CSVRow, WhatsappBroadcast, WhatsappBroadcastRecipient, PaginationMeta, RecipientBatchResponse } from '@/types';
import { parseCSV, validatePhoneNumber } from '@/lib/csv-parser';
import { Stepper, type Step } from '@/components/ui/stepper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Download, Upload, Send, Eye } from 'lucide-react';

const STEPS: Step[] = [
  { title: 'Template', description: 'Select template' },
  { title: 'Broadcast', description: 'Create campaign' },
  { title: 'Recipients', description: 'Upload CSV' },
  { title: 'Send', description: 'Launch campaign' },
  { title: 'Results', description: 'View stats' },
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Broadcast state
  const [broadcastName, setBroadcastName] = useState<string>('');
  const [currentBroadcast, setCurrentBroadcast] = useState<WhatsappBroadcast | null>(null);
  const [addingRecipients, setAddingRecipients] = useState<boolean>(false);
  const [recipientBatchResult, setRecipientBatchResult] = useState<RecipientBatchResponse | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [polling, setPolling] = useState<boolean>(false);

  // Recipients state
  const [recipients, setRecipients] = useState<WhatsappBroadcastRecipient[]>([]);
  const [recipientsMeta, setRecipientsMeta] = useState<PaginationMeta | null>(null);
  const [recipientsPage, setRecipientsPage] = useState<number>(1);

  // Helper function to extract parameter info (name and example)
  function getTemplateParameterInfo(template: Template): Array<{ name: string; example: string }> {
    if (!template.components) return [];

    const componentsArray = (template.components as any).components || template.components;
    if (!Array.isArray(componentsArray)) return [];

    const params: Array<{ name: string; example: string }> = [];
    let positionalIndex = 1;

    for (const component of componentsArray) {
      // Handle BODY and HEADER components
      if (component.type === 'BODY' || component.type === 'HEADER') {
        // Handle NAMED parameters
        if (component.example?.body_text_named_params) {
          for (const param of component.example.body_text_named_params) {
            params.push({ name: param.param_name, example: param.example });
          }
        } else if (component.example?.header_text_named_params) {
          for (const param of component.example.header_text_named_params) {
            params.push({ name: param.param_name, example: param.example });
          }
        }
        // Handle POSITIONAL parameters
        else if (component.example?.body_text && component.example.body_text.length > 0) {
          const positionalParams = component.example.body_text[0] || [];
          for (const example of positionalParams) {
            params.push({ name: `param${positionalIndex}`, example });
            positionalIndex++;
          }
        }
      }

      // Handle BUTTONS component
      if (component.type === 'BUTTONS' && component.buttons) {
        for (const button of component.buttons) {
          if (button.example && Array.isArray(button.example)) {
            for (const example of button.example) {
              params.push({ name: `button_param${positionalIndex}`, example });
              positionalIndex++;
            }
          }
        }
      }
    }

    return params;
  }

  // Helper function to extract parameter examples from template
  function getTemplateParameterExamples(template: Template): string[] {
    if (!template.components) {
      return [];
    }

    // Handle nested components structure: components.components
    const componentsArray = (template.components as any).components || template.components;

    if (!Array.isArray(componentsArray)) {
      return [];
    }

    const examples: string[] = [];

    for (const component of componentsArray) {
      // Handle BODY and HEADER components
      if (component.type === 'BODY' || component.type === 'HEADER') {
        // Handle NAMED parameter format (body_text_named_params)
        if (component.example?.body_text_named_params) {
          const namedParams = component.example.body_text_named_params;
          for (const param of namedParams) {
            examples.push(param.example);
          }
        }
        // Handle NAMED parameter format for headers (header_text_named_params)
        else if (component.example?.header_text_named_params) {
          const namedParams = component.example.header_text_named_params;
          for (const param of namedParams) {
            examples.push(param.example);
          }
        }
        // Handle POSITIONAL parameter format (body_text 2D array)
        else if (component.example?.body_text && component.example.body_text.length > 0) {
          // body_text is a 2D array, get the first example row
          const positionalParams = component.example.body_text[0] || [];
          examples.push(...positionalParams);
        }
      }

      // Handle BUTTONS component
      if (component.type === 'BUTTONS' && component.buttons) {
        for (const button of component.buttons) {
          if (button.example && Array.isArray(button.example)) {
            examples.push(...button.example);
          }
        }
      }
    }

    return examples;
  }

  // Helper function to convert params to Meta components format
  function convertToComponentsFormat(template: Template, params: string[]): Array<{ type: string; sub_type?: string; index?: string; parameters: Array<{ type: string; parameter_name?: string; text: string }> }> {
    const paramInfo = getTemplateParameterInfo(template);

    if (paramInfo.length === 0 || params.length === 0) {
      return [];
    }

    // Group parameters by component type
    const bodyParams: Array<{ type: string; parameter_name?: string; text: string }> = [];
    const headerParams: Array<{ type: string; parameter_name?: string; text: string }> = [];
    const buttonParams: Array<{ index: number; value: string }> = [];

    paramInfo.forEach((info, index) => {
      if (index >= params.length) return;

      // Check if this is a button parameter
      if (info.name.startsWith('button_param')) {
        const buttonIndex = buttonParams.length;
        buttonParams.push({ index: buttonIndex, value: params[index] });
        return;
      }

      const param = {
        type: 'text',
        parameter_name: info.name,
        text: params[index],
      };

      // Determine if this is a header or body parameter based on component type
      const componentsArray = (template.components as any)?.components || template.components;
      let isHeaderParam = false;

      if (Array.isArray(componentsArray)) {
        for (const comp of componentsArray) {
          if (comp.type === 'HEADER' && comp.example?.header_text_named_params) {
            const headerParamNames = comp.example.header_text_named_params.map((p: any) => p.param_name);
            if (headerParamNames.includes(info.name)) {
              isHeaderParam = true;
              break;
            }
          }
        }
      }

      if (isHeaderParam) {
        headerParams.push(param);
      } else {
        bodyParams.push(param);
      }
    });

    const components = [];
    if (headerParams.length > 0) {
      components.push({ type: 'header', parameters: headerParams });
    }
    if (bodyParams.length > 0) {
      components.push({ type: 'body', parameters: bodyParams });
    }
    // Add button components
    for (const buttonParam of buttonParams) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: String(buttonParam.index),
        parameters: [{ type: 'text', text: buttonParam.value }],
      });
    }

    return components;
  }

  // Helper function to generate CSV example based on template
  function generateCSVExample(template: Template): string {
    const paramInfo = getTemplateParameterInfo(template);
    const examples = getTemplateParameterExamples(template);

    // Generate header row using actual parameter names
    const headers = ['phone', ...paramInfo.map(p => p.name)];

    // Generate example rows using template examples or defaults
    const exampleValues = examples.length > 0 ? examples : Array(paramInfo.length).fill('value');
    const row1 = ['+15551234567', ...exampleValues];
    const row2 = ['+15559876543', ...exampleValues];

    return `${headers.join(',')}\n${row1.join(',')}\n${row2.join(',')}`;
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Auto-generate broadcast name when template is selected
  useEffect(() => {
    if (selectedTemplate && !broadcastName) {
      const timestamp = new Date().toISOString().split('T')[0];
      setBroadcastName(`${selectedTemplate.name}_${timestamp}`);
    }
  }, [selectedTemplate, broadcastName]);

  // Poll broadcast status when sending
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (polling && currentBroadcast?.id) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/broadcasts/${currentBroadcast.id}`);
          if (response.ok) {
            const data = await response.json();
            setCurrentBroadcast(data.data);

            // Stop polling if broadcast is completed or failed
            if (data.data.status === 'completed' || data.data.status === 'failed') {
              setPolling(false);
              setSending(false);
            }
          }
        } catch (err) {
          console.error('Error polling broadcast status:', err);
        }
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, currentBroadcast?.id]);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecipients(broadcastId: string, page: number = 1) {
    try {
      setLoading(true);
      const response = await fetch(`/api/broadcasts/${broadcastId}/recipients?page=${page}&per_page=20`);
      if (response.ok) {
        const data = await response.json();
        setRecipients(data.data || []);
        setRecipientsMeta(data.meta || null);
      }
    } catch (err) {
      console.error('Error fetching recipients:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }

  function handleCsvTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setCsvText(text);
    if (text.trim()) {
      const rows = parseCSV(text);
      setParsedRows(rows);
    } else {
      setParsedRows([]);
    }
  }

  async function handleCreateBroadcast() {
    if (!selectedTemplate || !broadcastName) {
      setError('Please select a template and provide a broadcast name');
      return;
    }

    const phoneNumberId = process.env.NEXT_PUBLIC_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      setError('PHONE_NUMBER_ID not configured. Please add it to your .env file.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_broadcast: {
            name: broadcastName,
            phone_number_id: phoneNumberId,
            whatsapp_template_id: selectedTemplate.id,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create broadcast');
      }

      const data = await response.json();
      setCurrentBroadcast(data.data);
      setCurrentStep(3); // Move to recipients step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create broadcast');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRecipients() {
    if (!currentBroadcast?.id) {
      setError('Please create a broadcast first');
      return;
    }

    if (!selectedTemplate) {
      setError('Template information not available');
      return;
    }

    if (parsedRows.length === 0) {
      setError('Please upload a CSV file with recipients');
      return;
    }

    // Validate phone numbers
    const invalidRows = parsedRows.filter(row => !validatePhoneNumber(row.phoneNumber));
    if (invalidRows.length > 0) {
      setError(`Invalid phone numbers: ${invalidRows.map(r => r.phoneNumber).join(', ')}`);
      return;
    }

    try {
      setAddingRecipients(true);
      setError('');
      setRecipientBatchResult(null);

      // Split into batches of 1000
      const batchSize = 1000;
      let totalAdded = 0;
      let totalDuplicates = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < parsedRows.length; i += batchSize) {
        const batch = parsedRows.slice(i, i + batchSize);

        const recipients = batch.map(row => ({
          phone_number: row.phoneNumber,
          components: row.params.length > 0
            ? convertToComponentsFormat(selectedTemplate, row.params)
            : undefined,
        }));

        const response = await fetch(`/api/broadcasts/${currentBroadcast.id}/recipients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsapp_broadcast: { recipients } }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add recipients');
        }

        const result = await response.json();
        totalAdded += result.data.added;
        totalDuplicates += result.data.duplicates;
        allErrors.push(...result.data.errors);
      }

      setRecipientBatchResult({
        added: totalAdded,
        duplicates: totalDuplicates,
        errors: allErrors,
      });

      // Refresh broadcast details
      const broadcastResponse = await fetch(`/api/broadcasts/${currentBroadcast.id}`);
      if (broadcastResponse.ok) {
        const data = await broadcastResponse.json();
        setCurrentBroadcast(data.data);
      }

      // Move to next step if recipients were added
      if (totalAdded > 0) {
        setCurrentStep(4);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipients');
    } finally {
      setAddingRecipients(false);
    }
  }

  async function handleSendBroadcast() {
    if (!currentBroadcast?.id) {
      setError('No broadcast to send');
      return;
    }

    if (currentBroadcast.total_recipients === 0) {
      setError('Please add recipients before sending');
      return;
    }

    try {
      setSending(true);
      setError('');

      const response = await fetch(`/api/broadcasts/${currentBroadcast.id}/send`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send broadcast');
      }

      // Start polling
      setPolling(true);

      // Fetch updated broadcast status
      const broadcastResponse = await fetch(`/api/broadcasts/${currentBroadcast.id}`);
      if (broadcastResponse.ok) {
        const data = await broadcastResponse.json();
        setCurrentBroadcast(data.data);
      }

      setCurrentStep(5); // Move to results step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send broadcast');
      setSending(false);
    }
  }

  async function handleViewRecipients() {
    if (currentBroadcast?.id) {
      await fetchRecipients(currentBroadcast.id, 1);
      setRecipientsPage(1);
    }
  }

  async function handleRefreshBroadcast() {
    if (!currentBroadcast?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/broadcasts/${currentBroadcast.id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentBroadcast(data.data);
      }
    } catch (err) {
      console.error('Error refreshing broadcast:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh broadcast');
    } finally {
      setLoading(false);
    }
  }

  function downloadCSVExample() {
    if (!selectedTemplate) {
      setError('Please select a template first');
      return;
    }

    // Generate example CSV based on template
    const exampleCSV = generateCSVExample(selectedTemplate);

    const blob = new Blob([exampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.name}_example.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleStepClick(step: number) {
    // Only allow going back to completed steps
    if (step < currentStep) {
      setCurrentStep(step);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">WhatsApp broadcasts</h1>

        {/* Stepper */}
        <div className="mb-8">
          <Stepper steps={STEPS} currentStep={currentStep} onStepClick={handleStepClick} />
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Step 1: Select Template */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select template</CardTitle>
              <CardDescription>Choose an approved WhatsApp template for your broadcast</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && templates.length === 0 ? (
                <p>Loading templates...</p>
              ) : (
                <>
                  <Select
                    value={selectedTemplate?.id || ''}
                    onValueChange={(value) => {
                      const template = templates.find(t => t.id === value);
                      setSelectedTemplate(template || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.language_code || template.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedTemplate && (
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="font-semibold">Name:</span>
                        <span>{selectedTemplate.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Language:</span>
                        <span>{selectedTemplate.language_code || selectedTemplate.language}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Category:</span>
                        <span>{selectedTemplate.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Parameters:</span>
                        <span>{getTemplateParameterInfo(selectedTemplate).length}</span>
                      </div>
                      {selectedTemplate.content && (
                        <div className="pt-2 border-t">
                          <p className="font-semibold mb-1">Template:</p>
                          <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
                        </div>
                      )}
                      {getTemplateParameterInfo(selectedTemplate).length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="font-semibold mb-1">Required parameters: {getTemplateParameterInfo(selectedTemplate).length}</p>
                          <div className="text-sm bg-background p-2 rounded font-mono">
                            {getTemplateParameterInfo(selectedTemplate).length > 0 ? (
                              <>
                                <p className="text-muted-foreground mb-1">Example values:</p>
                                {getTemplateParameterInfo(selectedTemplate).map((param, i) => (
                                  <div key={i}>
                                    {param.name}: <span className="text-muted-foreground">{param.example}</span>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div className="text-muted-foreground">
                                No examples available - you'll need to provide {selectedTemplate.parameter_count} parameter(s)
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (selectedTemplate) {
                          setCurrentStep(2);
                        } else {
                          setError('Please select a template');
                        }
                      }}
                      disabled={!selectedTemplate}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Create Broadcast */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Create broadcast</CardTitle>
              <CardDescription>Name your campaign and create a draft broadcast</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Broadcast name</label>
                <Input
                  type="text"
                  placeholder="e.g., Summer Sale 2024"
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                />
              </div>

              {currentBroadcast && (
                <div className="p-4 bg-green-50 rounded-lg space-y-1">
                  <p className="font-semibold">✓ Broadcast created: {currentBroadcast.name}</p>
                  <p className="text-sm text-muted-foreground">Status: {currentBroadcast.status}</p>
                  <p className="text-sm text-muted-foreground">Recipients: {currentBroadcast.total_recipients}</p>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateBroadcast}
                  disabled={loading || !broadcastName || !!currentBroadcast}
                >
                  {loading ? 'Creating...' : currentBroadcast ? 'Broadcast created' : 'Create broadcast'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Upload CSV & Add Recipients */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Upload recipients</CardTitle>
              <CardDescription>
                Upload a CSV file with phone numbers and template parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  First column: phone number, remaining columns: template parameters
                </p>
                <Button variant="outline" size="sm" onClick={downloadCSVExample}>
                  <Download className="w-4 h-4 mr-2" />
                  Download example
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Upload file</label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Or paste CSV content</label>
                <Textarea
                  rows={8}
                  placeholder={selectedTemplate ? generateCSVExample(selectedTemplate) : "phone,param1,param2\n+15551234567,John,Order123\n+15559876543,Jane,Order456"}
                  value={csvText}
                  onChange={handleCsvTextChange}
                  className="font-mono text-sm"
                />
              </div>

              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Preview ({parsedRows.length} rows)</h3>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">Phone</th>
                          <th className="px-4 py-2 text-left">Parameters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2">{row.phoneNumber}</td>
                            <td className="px-4 py-2">{row.params.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 5 && (
                    <p className="text-sm text-muted-foreground">
                      ... and {parsedRows.length - 5} more rows
                    </p>
                  )}
                </div>
              )}

              {recipientBatchResult && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                  <h3 className="font-semibold">Recipients added</h3>
                  <p className="text-sm">✅ Added: {recipientBatchResult.added}</p>
                  <p className="text-sm">⚠️ Duplicates: {recipientBatchResult.duplicates}</p>
                  {recipientBatchResult.errors.length > 0 && (
                    <>
                      <p className="text-sm text-destructive font-semibold mt-2">❌ Errors:</p>
                      <ul className="text-xs text-destructive list-disc list-inside">
                        {recipientBatchResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                      {recipientBatchResult.errors.length > 5 && (
                        <p className="text-xs text-destructive">
                          ... and {recipientBatchResult.errors.length - 5} more errors
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  Back
                </Button>
                <Button
                  onClick={handleAddRecipients}
                  disabled={addingRecipients || parsedRows.length === 0}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {addingRecipients ? 'Adding...' : `Add ${parsedRows.length} recipients`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Send Broadcast */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Send broadcast</CardTitle>
                  <CardDescription>Launch your WhatsApp broadcast campaign</CardDescription>
                </div>
                {currentBroadcast && (
                  <Button variant="outline" size="sm" onClick={handleRefreshBroadcast} disabled={loading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentBroadcast && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Campaign:</span>
                    <span>{currentBroadcast.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Template:</span>
                    <span>{currentBroadcast.whatsapp_template.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Recipients:</span>
                    <span>{currentBroadcast.total_recipients}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Status:</span>
                    <span className="capitalize">{currentBroadcast.status}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={handleSendBroadcast}
                  disabled={sending || !currentBroadcast || currentBroadcast.total_recipients === 0 || currentBroadcast.status !== 'draft'}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? 'Sending...' : `Send to ${currentBroadcast?.total_recipients || 0} recipients`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Results */}
        {currentStep === 5 && currentBroadcast && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Broadcast results</CardTitle>
                    <CardDescription>Real-time campaign statistics</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRefreshBroadcast} disabled={loading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-semibold text-lg mb-2">
                    Status: <span className="capitalize">{currentBroadcast.status}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-3xl font-bold">{currentBroadcast.sent_count}</div>
                    <div className="text-sm text-muted-foreground">Sent</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-3xl font-bold">{currentBroadcast.delivered_count}</div>
                    <div className="text-sm text-muted-foreground">Delivered</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-3xl font-bold">{currentBroadcast.read_count}</div>
                    <div className="text-sm text-muted-foreground">Read</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-3xl font-bold">{currentBroadcast.failed_count}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm">
                    Response rate: <span className="font-semibold text-lg">{currentBroadcast.response_rate}%</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentBroadcast.responded_count} out of {currentBroadcast.total_recipients} recipients responded
                  </p>
                </div>

                <Button onClick={handleViewRecipients} variant="outline" className="w-full">
                  <Eye className="w-4 h-4 mr-2" />
                  View recipient details
                </Button>
              </CardContent>
            </Card>

            {/* Recipients Details */}
            {recipients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recipient details</CardTitle>
                  <CardDescription>Individual delivery status for each recipient</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">Phone</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Delivered</th>
                          <th className="px-4 py-2 text-left">Read</th>
                          <th className="px-4 py-2 text-left">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((recipient) => (
                          <tr key={recipient.id} className="border-t">
                            <td className="px-4 py-2">{recipient.phone_number}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                recipient.status === 'sent' ? 'bg-green-100 text-green-800' :
                                recipient.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {recipient.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">{recipient.delivered_at ? '✅' : '-'}</td>
                            <td className="px-4 py-2">{recipient.read_at ? '👁️' : '-'}</td>
                            <td className="px-4 py-2 text-xs text-destructive">{recipient.error_message || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {recipientsMeta && (
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Page {recipientsMeta.page} of {recipientsMeta.total_pages} ({recipientsMeta.total_count} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (currentBroadcast?.id && recipientsPage > 1) {
                              const newPage = recipientsPage - 1;
                              setRecipientsPage(newPage);
                              fetchRecipients(currentBroadcast.id, newPage);
                            }
                          }}
                          disabled={recipientsPage <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (currentBroadcast?.id && recipientsPage < (recipientsMeta?.total_pages || 0)) {
                              const newPage = recipientsPage + 1;
                              setRecipientsPage(newPage);
                              fetchRecipients(currentBroadcast.id, newPage);
                            }
                          }}
                          disabled={recipientsPage >= (recipientsMeta?.total_pages || 0)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
