// A message a visitor sent to a seller (as the seller sees it in the inbox)
export interface Inquiry {
  id: number;
  productId: number | null; // null once the product has been deleted
  productName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// What the visitor's form sends
export interface InquiryInput {
  name: string;
  email: string;
  message: string;
  companyWebsite: string; // the hidden "honeypot" field: always empty for real people
}

export interface InquiryQueryParams {
  unread?: boolean;
  page?: number;
  pageSize?: number;
}
