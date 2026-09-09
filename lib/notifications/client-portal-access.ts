type DeliveryStatus = "sent" | "skipped" | "failed";

export type ClientPortalAccessDeliveryResult = {
  email: DeliveryStatus;
  whatsapp: DeliveryStatus;
  errors: string[];
};

type ClientPortalAccessPayload = {
  companyName?: string | null;
  customerName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  password: string;
  portalUrl: string;
};

async function postWebhook(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned HTTP ${response.status}`);
  }
}

export async function sendClientPortalAccess(
  payload: ClientPortalAccessPayload,
): Promise<ClientPortalAccessDeliveryResult> {
  const errors: string[] = [];
  let email: DeliveryStatus = "skipped";
  let whatsapp: DeliveryStatus = "skipped";

  const message = {
    type: "CLIENT_PORTAL_ACCESS",
    to: {
      email: payload.email,
      phone: payload.phone,
      name: payload.contactName || payload.customerName,
    },
    subject: "Your FreightFast client portal login",
    body: {
      companyName: payload.companyName,
      customerName: payload.customerName,
      portalUrl: payload.portalUrl,
      email: payload.email,
      password: payload.password,
    },
  };

  if (process.env.CLIENT_PORTAL_EMAIL_WEBHOOK_URL && payload.email) {
    try {
      await postWebhook(process.env.CLIENT_PORTAL_EMAIL_WEBHOOK_URL, message);
      email = "sent";
    } catch (error) {
      email = "failed";
      errors.push(error instanceof Error ? error.message : "Email webhook failed.");
    }
  }

  if (process.env.CLIENT_PORTAL_WHATSAPP_WEBHOOK_URL && payload.phone) {
    try {
      await postWebhook(process.env.CLIENT_PORTAL_WHATSAPP_WEBHOOK_URL, message);
      whatsapp = "sent";
    } catch (error) {
      whatsapp = "failed";
      errors.push(error instanceof Error ? error.message : "WhatsApp webhook failed.");
    }
  }

  return { email, whatsapp, errors };
}
