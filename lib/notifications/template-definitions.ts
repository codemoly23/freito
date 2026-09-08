export const customerSafeTemplateVariables = [
  "customerName",
  "companyName",
  "requestNumber",
  "quotationNumber",
  "shipmentNumber",
  "status",
  "linkUrl",
  "clientId",
  "oneTimePassword",
  "activationLink",
  "expiresAt",
  "portalLoginUrl",
  "invoiceNo",
  "dueAmount",
  "dueDate",
  "scheduledDate",
] as const;

type TemplateDefinition = {
  key: string;
  name: string;
  description: string;
  audienceScope: "COMPANY" | "CLIENT_PORTAL";
  subject: string;
  body: string;
};

export const systemNotificationTemplateDefinitions: TemplateDefinition[] = [
  {
    key: "shipment_request_submitted",
    name: "Shipment request submitted",
    description: "Acknowledges a new shipment request.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Shipment request {{requestNumber}} received",
    body: "Hello {{customerName}}, {{companyName}} received shipment request {{requestNumber}}. Status: {{status}}. View: {{linkUrl}}",
  },
  {
    key: "quotation_created",
    name: "Quotation created",
    description: "Notifies a customer that a quotation is available.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Quotation {{quotationNumber}} is available",
    body: "Hello {{customerName}}, quotation {{quotationNumber}} is available for request {{requestNumber}}. View: {{linkUrl}}",
  },
  {
    key: "quotation_accepted",
    name: "Quotation accepted",
    description: "Confirms that a quotation was accepted.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Quotation {{quotationNumber}} accepted",
    body: "Hello {{customerName}}, your acceptance of quotation {{quotationNumber}} for request {{requestNumber}} has been recorded. Status: {{status}}.",
  },
  {
    key: "quotation_rejected",
    name: "Quotation rejected",
    description: "Confirms that a quotation was rejected.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Quotation {{quotationNumber}} response recorded",
    body: "Hello {{customerName}}, your response to quotation {{quotationNumber}} for request {{requestNumber}} has been recorded. Status: {{status}}.",
  },
  {
    key: "quotation_revision_requested",
    name: "Quotation revision requested",
    description: "Confirms that a quotation revision was requested.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Quotation {{quotationNumber}} revision requested",
    body: "Hello {{customerName}}, your revision request for quotation {{quotationNumber}} has been recorded. Status: {{status}}.",
  },
  {
    key: "shipment_created",
    name: "Shipment created",
    description: "Notifies a customer that a shipment was created.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Shipment {{shipmentNumber}} created",
    body: "Hello {{customerName}}, shipment {{shipmentNumber}} was created from request {{requestNumber}}. View: {{linkUrl}}",
  },
  {
    key: "document_rejected",
    name: "Document rejected",
    description: "Notifies a customer that a document needs attention without exposing internal remarks.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Document update for shipment {{shipmentNumber}}",
    body: "Hello {{customerName}}, a document for shipment {{shipmentNumber}} requires attention. Status: {{status}}. View: {{linkUrl}}",
  },
  {
    key: "workflow_step_assigned",
    name: "Workflow step assigned",
    description: "Notifies an internal user about an assigned workflow step.",
    audienceScope: "COMPANY",
    subject: "Workflow assignment for shipment {{shipmentNumber}}",
    body: "A workflow step was assigned for shipment {{shipmentNumber}}. Status: {{status}}. View: {{linkUrl}}",
  },
  {
    key: "invoice_sent",
    name: "Invoice sent",
    description: "Notifies a customer that an invoice has been sent.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Invoice {{invoiceNo}} sent",
    body: "Hello {{customerName}}, invoice {{invoiceNo}} has been sent. Amount due: {{dueAmount}} by {{dueDate}}. View: {{linkUrl}}",
  },
  {
    key: "delivery_scheduled",
    name: "Delivery scheduled",
    description: "Notifies a customer that delivery has been scheduled.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Delivery scheduled for shipment {{shipmentNumber}}",
    body: "Hello {{customerName}}, delivery for shipment {{shipmentNumber}} was scheduled for {{scheduledDate}}. View: {{linkUrl}}",
  },
  {
    key: "out_for_delivery",
    name: "Out for delivery",
    description: "Notifies a customer that a shipment is out for delivery.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Shipment {{shipmentNumber}} is out for delivery",
    body: "Hello {{customerName}}, shipment {{shipmentNumber}} is now out for delivery. View: {{linkUrl}}",
  },
  {
    key: "delivered",
    name: "Shipment delivered",
    description: "Notifies a customer that a shipment has been delivered.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Shipment {{shipmentNumber}} delivered",
    body: "Hello {{customerName}}, shipment {{shipmentNumber}} has been delivered. View: {{linkUrl}}",
  },
  {
    key: "pod_uploaded",
    name: "Proof of delivery uploaded",
    description: "Notifies a customer that proof of delivery is available.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Proof of delivery available for shipment {{shipmentNumber}}",
    body: "Hello {{customerName}}, proof of delivery for shipment {{shipmentNumber}} is available. View: {{linkUrl}}",
  },
  {
    key: "pod_verified",
    name: "Proof of delivery verified",
    description: "Notifies a customer that proof of delivery has been verified.",
    audienceScope: "CLIENT_PORTAL",
    subject: "Proof of delivery verified for shipment {{shipmentNumber}}",
    body: "Hello {{customerName}}, proof of delivery for shipment {{shipmentNumber}} has been verified. View: {{linkUrl}}",
  },
];

export const externalNotificationChannels = ["EMAIL", "WHATSAPP"] as const;

export const portalAccessTemplateDefinitions = [
  ["customer_portal_access_email", "EMAIL", "Customer portal access invitation", "Your {{companyName}} portal access details", "Hello {{customerName}}, your {{companyName}} portal Client ID is: {{clientId}} and One-Time Password is: {{oneTimePassword}}. Please login here and update your password: {{portalLoginUrl}}"],
  ["customer_portal_access_whatsapp", "WHATSAPP", "Customer portal access invitation", null, "Hello {{customerName}}, your {{companyName}} portal Client ID is {{clientId}} and One-Time Password is {{oneTimePassword}}. Login & change password: {{portalLoginUrl}}"],
  ["customer_portal_access_sms", "SMS", "Customer portal access invitation", null, "{{companyName}} portal access. Client ID: {{clientId}}, One-Time Password: {{oneTimePassword}}. Login: {{portalLoginUrl}}"],
  ["customer_portal_access_resend_email", "EMAIL", "Customer portal access invitation resend", "Your {{companyName}} portal access details (Reset)", "Hello {{customerName}}, your {{companyName}} portal Client ID is: {{clientId}} and new One-Time Password is: {{oneTimePassword}}. Login here: {{portalLoginUrl}}"],
  ["customer_portal_access_resend_whatsapp", "WHATSAPP", "Customer portal access invitation resend", null, "Hello {{customerName}}, your {{companyName}} portal Client ID is {{clientId}} and new One-Time Password is {{oneTimePassword}}. Login: {{portalLoginUrl}}"],
  ["customer_portal_access_resend_sms", "SMS", "Customer portal access invitation resend", null, "{{companyName}} portal reset. Client ID: {{clientId}}, One-Time Password: {{oneTimePassword}}. Login: {{portalLoginUrl}}"],
] as const;

export const clientShareTemplateDefinitions = [
  ["client_share_email", "EMAIL", "Client-facing shared item", "A secure item was shared with you", "A customer-safe item is available in your secure client portal: {{linkUrl}}"],
  ["client_share_whatsapp", "WHATSAPP", "Client-facing shared item", null, "A customer-safe item is available in your secure client portal: {{linkUrl}}"],
] as const;
