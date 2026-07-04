import { Injectable } from '@nestjs/common';
import { ModuleHelp } from './help.interface';

@Injectable()
export class HelpRegistry {
  private readonly modules = new Map<string, ModuleHelp>();

  register(help: ModuleHelp): void {
    this.modules.set(help.module, help);
  }

  get(moduleKey: string): ModuleHelp | undefined {
    return this.modules.get(moduleKey);
  }

  getAll(): ModuleHelp[] {
    return Array.from(this.modules.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }

  index(): Array<{ module: string; title: string; phase: string; description: string }> {
    return this.getAll().map(({ module, title, phase, description }) => ({
      module,
      title,
      phase,
      description,
    }));
  }
}
