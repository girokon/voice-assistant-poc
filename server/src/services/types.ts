export interface FunctionParameter {
  type: string;
  description: string;
  enum?: string[];
  required?: boolean;
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface BaseFunction {
  definition: ToolFunction;
  execute(args: Record<string, any>): Promise<any>;
}
