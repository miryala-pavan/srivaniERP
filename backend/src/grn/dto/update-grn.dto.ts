import { PartialType } from '@nestjs/mapped-types';
import { CreateGrnDto } from './create-grn.dto';

export class UpdateGrnDto extends PartialType(CreateGrnDto) {}
