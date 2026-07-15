import { PartialType } from '@nestjs/mapped-types';
import { CreateCannedReplyDto } from './create-canned-reply.dto';

export class UpdateCannedReplyDto extends PartialType(CreateCannedReplyDto) {}
