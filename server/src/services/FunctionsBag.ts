import { BaseFunction, Tool } from './types.js';

export class FunctionsBag {
  private functions: Map<string, BaseFunction> = new Map();

  registerFunction(func: BaseFunction) {
    this.functions.set(func.definition.name, func);
  }

  getTools(): Tool[] {
    return Array.from(this.functions.values()).map((func) => ({
      type: 'function',
      function: func.definition,
    }));
  }

  async executeFunction(name: string, args: Record<string, any>): Promise<any> {
    const func = this.functions.get(name);
    if (!func) {
      throw new Error(`Function ${name} not found`);
    }
    return await func.execute(args);
  }
}
