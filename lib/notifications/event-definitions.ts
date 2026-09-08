// Phase 02 (Automated Status Notifications) event catalog. Each event targets
// the specific person already tied to the record (creator/assignee, and that
// record's own customer portal account) -- the same pattern already used by
// the existing booking-confirmation/workflow-assignment triggers -- rather
// than a new company-wide role-based fan-out. Only events with a `portal`
// block need a `notificationtemplate` row (see systemNotificationTemplateDefinitions
// in template-definitions.ts); internal-only events stay in-app-only, matching
// the existing booking_confirmed/BL-lock precedent which never touches the
// delivery outbox.

export type NotificationEventKey =
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "payment_received"
  | "vendor_bill_created"
  | "vendor_bill_received"
  | "vendor_bill_paid"
  | "delivery_order_verified"
  | "customs_release_verified"
  | "gate_pass_verified"
  | "cargo_released"
  | "delivery_scheduled"
  | "out_for_delivery"
  | "delivered"
  | "pod_uploaded"
  | "pod_verified"
  | "approval_requested"
  | "approval_decided";

export type NotificationEventDefinition = {
  eventKey: NotificationEventKey;
  /** {{var}} template, rendered with renderTemplate() from templates.ts */
  internalTitle: string;
  internalMessage: string;
  /** Present only for events that are also customer-facing (portal + optional email/WhatsApp outbox). */
  portal?: {
    templateKey: string;
    title: string;
    message: string;
  };
};

export const notificationEventDefinitions: Record<NotificationEventKey, NotificationEventDefinition> = {
  invoice_created: {
    eventKey: "invoice_created",
    internalTitle: "Invoice {{invoiceNo}} created",
    internalMessage: "Invoice {{invoiceNo}} was created for {{customerName}} ({{totalAmount}} {{currency}}).",
  },
  invoice_sent: {
    eventKey: "invoice_sent",
    internalTitle: "Invoice {{invoiceNo}} sent",
    internalMessage: "Invoice {{invoiceNo}} was sent to {{customerName}}. Due {{dueDate}}.",
    portal: {
      templateKey: "invoice_sent",
      title: "Invoice {{invoiceNo}} sent",
      message: "Hello {{customerName}}, invoice {{invoiceNo}} has been sent. Amount due: {{dueAmount}} by {{dueDate}}. View: {{linkUrl}}",
    },
  },
  invoice_paid: {
    eventKey: "invoice_paid",
    internalTitle: "Invoice {{invoiceNo}} paid",
    internalMessage: "Invoice {{invoiceNo}} is now fully paid ({{paidAmount}} {{currency}}).",
  },
  payment_received: {
    eventKey: "payment_received",
    internalTitle: "Payment {{paymentNo}} recorded",
    internalMessage: "Payment {{paymentNo}} of {{amount}} {{currency}} was recorded.",
  },
  vendor_bill_created: {
    eventKey: "vendor_bill_created",
    internalTitle: "Vendor bill {{billNo}} created",
    internalMessage: "Vendor bill {{billNo}} was created for {{vendorName}} ({{totalAmount}} {{currency}}).",
  },
  vendor_bill_received: {
    eventKey: "vendor_bill_received",
    internalTitle: "Vendor bill {{billNo}} received",
    internalMessage: "Vendor bill {{billNo}} status changed to received.",
  },
  vendor_bill_paid: {
    eventKey: "vendor_bill_paid",
    internalTitle: "Vendor bill {{billNo}} paid",
    internalMessage: "Vendor bill {{billNo}} is now fully paid ({{paidAmount}} {{currency}}).",
  },
  delivery_order_verified: {
    eventKey: "delivery_order_verified",
    internalTitle: "Delivery order verified",
    internalMessage: "Delivery order was verified for shipment {{jobNo}}.",
  },
  customs_release_verified: {
    eventKey: "customs_release_verified",
    internalTitle: "Customs release verified",
    internalMessage: "Customs release was verified for shipment {{jobNo}}.",
  },
  gate_pass_verified: {
    eventKey: "gate_pass_verified",
    internalTitle: "Gate pass verified",
    internalMessage: "Gate pass was verified for shipment {{jobNo}}.",
  },
  cargo_released: {
    eventKey: "cargo_released",
    internalTitle: "Cargo released",
    internalMessage: "Cargo was released for shipment {{jobNo}}.",
  },
  delivery_scheduled: {
    eventKey: "delivery_scheduled",
    internalTitle: "Delivery scheduled for {{jobNo}}",
    internalMessage: "Delivery for shipment {{jobNo}} was scheduled for {{scheduledDate}}.",
    portal: {
      templateKey: "delivery_scheduled",
      title: "Delivery scheduled",
      message: "Hello {{customerName}}, delivery for shipment {{shipmentNumber}} was scheduled for {{scheduledDate}}. View: {{linkUrl}}",
    },
  },
  out_for_delivery: {
    eventKey: "out_for_delivery",
    internalTitle: "Shipment {{jobNo}} out for delivery",
    internalMessage: "Shipment {{jobNo}} is now out for delivery.",
    portal: {
      templateKey: "out_for_delivery",
      title: "Your shipment is out for delivery",
      message: "Hello {{customerName}}, shipment {{shipmentNumber}} is now out for delivery. View: {{linkUrl}}",
    },
  },
  delivered: {
    eventKey: "delivered",
    internalTitle: "Shipment {{jobNo}} delivered",
    internalMessage: "Shipment {{jobNo}} was marked delivered.",
    portal: {
      templateKey: "delivered",
      title: "Shipment delivered",
      message: "Hello {{customerName}}, shipment {{shipmentNumber}} has been delivered. View: {{linkUrl}}",
    },
  },
  pod_uploaded: {
    eventKey: "pod_uploaded",
    internalTitle: "POD uploaded for {{jobNo}}",
    internalMessage: "Proof of delivery was uploaded for shipment {{jobNo}} (ref {{podReferenceNo}}).",
    portal: {
      templateKey: "pod_uploaded",
      title: "Proof of delivery available",
      message: "Hello {{customerName}}, proof of delivery for shipment {{shipmentNumber}} is available. View: {{linkUrl}}",
    },
  },
  pod_verified: {
    eventKey: "pod_verified",
    internalTitle: "POD verified for {{jobNo}}",
    internalMessage: "Proof of delivery was verified for shipment {{jobNo}}.",
    portal: {
      templateKey: "pod_verified",
      title: "Proof of delivery verified",
      message: "Hello {{customerName}}, proof of delivery for shipment {{shipmentNumber}} has been verified. View: {{linkUrl}}",
    },
  },
  approval_requested: {
    eventKey: "approval_requested",
    internalTitle: "Approval needed: {{documentLabel}} {{documentNo}}",
    internalMessage: "{{documentLabel}} {{documentNo}} ({{amount}} {{currency}}) needs your approval (step {{stepSequence}} of {{stepCount}}).",
  },
  approval_decided: {
    eventKey: "approval_decided",
    internalTitle: "{{documentLabel}} {{documentNo}} {{decision}}",
    internalMessage: "Your {{documentLabel}} {{documentNo}} was {{decision}} by {{decidedByName}}{{remarksSuffix}}.",
  },
};
