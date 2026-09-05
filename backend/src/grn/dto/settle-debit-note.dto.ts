import { IsString, IsNotEmpty } from 'class-validator';

export class LinkReplacementGrnDto {
  @IsString() @IsNotEmpty() grnId: string;
}

export class MarkDebitNoteRefundedDto {
  @IsString() @IsNotEmpty() refundReference: string;
}
