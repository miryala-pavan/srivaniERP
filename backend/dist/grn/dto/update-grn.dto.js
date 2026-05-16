"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGrnDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_grn_dto_1 = require("./create-grn.dto");
class UpdateGrnDto extends (0, mapped_types_1.PartialType)(create_grn_dto_1.CreateGrnDto) {
}
exports.UpdateGrnDto = UpdateGrnDto;
//# sourceMappingURL=update-grn.dto.js.map