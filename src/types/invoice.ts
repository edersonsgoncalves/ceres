export interface InvoiceItem {
  productName: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  barcode?: string;
}

export interface InvoiceData {
  storeName: string;
  cnpj?: string;
  date?: string;
  total: number;
  items: InvoiceItem[];
  paymentMethod?: string;
}

export interface InvoiceImportPayload {
  store: {
    name: string;
    cnpj?: string;
  };
  invoiceNumber?: string;
  issueDate: string;
  totalAmount: number;
  paymentMethod?: string;
  items: Array<{
    productName: string;
    barcode?: string;
    category?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice?: number;
  }>;
}
