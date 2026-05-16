"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DayClosureModule = void 0;
const common_1 = require("@nestjs/common");
const day_closure_service_1 = require("./day-closure.service");
const day_closure_controller_1 = require("./day-closure.controller");
const notifications_module_1 = require("../notifications/notifications.module");
let DayClosureModule = class DayClosureModule {
};
exports.DayClosureModule = DayClosureModule;
exports.DayClosureModule = DayClosureModule = __decorate([
    (0, common_1.Module)({
        imports: [notifications_module_1.NotificationsModule],
        providers: [day_closure_service_1.DayClosureService],
        controllers: [day_closure_controller_1.DayClosureController],
    })
], DayClosureModule);
//# sourceMappingURL=day-closure.module.js.map