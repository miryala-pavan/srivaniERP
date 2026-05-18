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
exports.UpdateBusinessDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateBusinessDto {
    name;
    gstin;
    stateCode;
    stateName;
    address;
    phone;
    email;
    pan;
    tan;
    professionalTaxNo;
    fssaiLicense;
    fssaiExpiry;
    drugLicense;
    drugLicenseExpiry;
    tradeLicense;
    tradeLicenseExpiry;
    shopEstablishmentLicense;
    shopEstablishmentExpiry;
    fireSafetyNoc;
    fireSafetyNocExpiry;
    weightsAndMeasuresLicense;
    weightsAndMeasuresExpiry;
    liquorLicense;
    liquorLicenseExpiry;
    udyamRegistration;
    cin;
    iecCode;
}
exports.UpdateBusinessDto = UpdateBusinessDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, {
        message: 'GSTIN must be a valid 15-character GST Identification Number',
    }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "gstin", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{2}$/, { message: 'State code must be exactly 2 digits' }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "stateCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "stateName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'Email must be a valid email address' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must be in format AAAAA0000A' }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "pan", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[A-Z]{4}\d{5}[A-Z]$/, { message: 'TAN must be in format AAAA00000A' }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "tan", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "professionalTaxNo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{14}$/, { message: 'FSSAI license must be exactly 14 digits' }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "fssaiLicense", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "fssaiExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "drugLicense", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "drugLicenseExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "tradeLicense", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "tradeLicenseExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "shopEstablishmentLicense", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "shopEstablishmentExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "fireSafetyNoc", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "fireSafetyNocExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "weightsAndMeasuresLicense", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "weightsAndMeasuresExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "liquorLicense", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "liquorLicenseExpiry", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "udyamRegistration", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, {
        message: 'CIN must be 21 characters in standard format (e.g. L17110MH1973PLC019786)',
    }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "cin", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{10}$/, { message: 'IEC code must be exactly 10 digits' }),
    __metadata("design:type", String)
], UpdateBusinessDto.prototype, "iecCode", void 0);
//# sourceMappingURL=update-business.dto.js.map