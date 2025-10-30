export type Template = {
  id: string;
  name: string;
  language_code?: string;
  language?: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  content?: string;
  parameter_format?: 'NAMED' | 'POSITIONAL';
  business_account_id?: string;
  components?: TemplateComponent[] | { components: TemplateComponent[] };
  created_at?: string;
  updated_at?: string;
};

export type TemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    body_text_named_params?: Array<{
      param_name: string;
      example: string;
    }>;
    header_text_named_params?: Array<{
      param_name: string;
      example: string;
    }>;
  };
  buttons?: TemplateButton[];
};

export type TemplateButton = {
  type: string;
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};

export type CSVRow = {
  phoneNumber: string;
  params: string[];
};

// Broadcast API types
export type BasicWhatsappTemplate = {
  id: string;
  name: string;
  language_code: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
};

export type WhatsappBroadcast = {
  id: string;
  name: string;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  phone_number_id: string | null;
  whatsapp_template: BasicWhatsappTemplate;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  read_count: number;
  responded_count: number;
  pending_count: number;
  response_rate: number;
};

export type WhatsappBroadcastRecipient = {
  id: string;
  phone_number: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  failed_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  responded_at: string | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  template_parameters: string[] | Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type RecipientBatchResponse = {
  added: number;
  duplicates: number;
  errors: string[];
};

export type PaginationMeta = {
  page: number;
  per_page: number;
  total_pages: number;
  total_count: number;
};

export type CreateBroadcastRequest = {
  whatsapp_broadcast: {
    name: string;
    phone_number_id: string;
    whatsapp_template_id: string;
  };
};

export type TemplateComponentParameter = {
  type: string;
  parameter_name?: string;
  text?: string;
  image?: Record<string, unknown>;
  video?: Record<string, unknown>;
  document?: Record<string, unknown>;
};

export type RecipientComponent = {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: string;
  parameters: TemplateComponentParameter[];
};

export type AddRecipientsRequest = {
  whatsapp_broadcast: {
    recipients: Array<{
      phone_number?: string;
      whatsapp_contact_id?: string;
      components?: RecipientComponent[];
    }>;
  };
};
