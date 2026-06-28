export class ReviewItemDto {
  productCode: string;
  productName: string;
  packLabel: string;
  rating: number; // 1–5
  comment?: string;
}

export class SubmitReviewsDto {
  orderNumber: string;
  reviews: ReviewItemDto[];
}
