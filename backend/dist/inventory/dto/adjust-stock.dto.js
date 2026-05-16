"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdjustStockDto = exports.AdjustmentType = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var AdjustmentType;
(function (AdjustmentType) {
    AdjustmentType["DAMAGE"] = "DAMAGE";
    AdjustmentType["LOSS"] = "LOSS";
    AdjustmentType["FOUND"] = "FOUND";
    AdjustmentType["EXPIRY"] = "EXPIRY";
    AdjustmentType["RECOUNT"] = "RECOUNT";
})(AdjustmentType || (exports.AdjustmentType = AdjustmentType = {}));
class AdjustStockDto {
    productId;
    branchId;
    adjustedQuantity;
    reason;
    type;
}
exports.AdjustStockDto = AdjustStockDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdjustStockDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdjustStockDto.prototype, "branchId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 3 }),
    (0, class_validator_1.IsNotIn)([0], { message: 'adjustedQuantity cannot be zero' }),
    __metadata("design:type", Number)
], AdjustStockDto.prototype, "adjustedQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], AdjustStockDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(AdjustmentType),
    __metadata("design:type", String)
], AdjustStockDto.prototype, "type", void 0);
//# sourceMappingURL=adjust-stock.dto.js.map