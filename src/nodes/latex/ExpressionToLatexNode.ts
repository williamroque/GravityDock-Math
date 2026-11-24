import { BaseNode } from '@gravitydock/types';
import type { InputDefinition, OutputDefinition, PropertyDefinition } from '@gravitydock/types';
import { MathCategory } from '../../category';
import * as math from 'mathjs';

function splitEquation(expr: string): string[] {
    const parts: string[] = [];
    let start = 0;
    let quote: string | null = null;

    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (quote) {
            if (ch === '\\') {
                i++;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === '\'' || ch === '\x22') {
            quote = ch;
            continue;
        }
        if (ch === '=') {
            const prev = i > 0 ? expr[i - 1] : '';
            const next = i + 1 < expr.length ? expr[i + 1] : '';
            if (prev !== '<' && prev !== '>' && prev !== '!' && prev !== '=' && prev !== ':' && next !== '=') {
                parts.push(expr.slice(start, i));
                start = i + 1;
            }
        }
    }
    parts.push(expr.slice(start));
    return parts;
}

function exprToTex(expr: string, implicit: string): string {
    const node = math.parse(expr);

    // mathjs toTex only distinguishes 'hide' (outputs ~) vs everything-else (outputs \cdot).
    let tex: string;
    if (implicit === 'cdot') {
        tex = node.toTex({ implicit: 'show' });
        tex = tex.replace(/~/g, ' \\cdot ');
    } else if (implicit === 'space') {
        tex = node.toTex({ implicit: 'hide' });
        tex = tex.replace(/~/g, '\\;');
        tex = tex.replace(/\\cdot/g, '\\;');
    } else {
        tex = node.toTex({ implicit: 'hide' });
        tex = tex.replace(/~/g, '');
        tex = tex.replace(/\s*\\cdot\s*/g, '');
    }
    return tex;
}

export class ExpressionToLatexNode extends BaseNode {
    readonly typeId = 'math-expression-to-latex';
    readonly displayName = 'Expression to LaTeX';
    readonly category = MathCategory;
    readonly visible = true;
    
    readonly inputs: InputDefinition[] = [
        { name: 'Expression', acceptsType: 'core:expression' }
    ];
    
    readonly outputs: OutputDefinition[] = [
        { name: 'LaTeX', outputType: 'core:string' }
    ];
    
    readonly properties: PropertyDefinition[] = [
        { name: 'implicit', label: 'Implicit Multiplication', type: 'select' as any, options: [
            { value: 'hide', label: 'Hide' },
            { value: 'space', label: 'Space' },
            { value: 'cdot', label: 'Dot (·)' }
        ], defaultValue: 'hide' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>): Promise<Record<string, any>> {
        const exprInput = inputs['Expression'];
        const exprStr = (typeof exprInput === 'string' ? exprInput : exprInput?.source) || '';
        if (!exprStr) return { 'LaTeX': '' };

        const implicit = properties['implicit'] || 'hide';

        try {
            let tex: string;
            try {
                tex = exprToTex(exprStr, implicit);
            } catch (parseErr) {
                const parts = splitEquation(exprStr);
                if (parts.length <= 1 || parts.some((p) => !p.trim())) {
                    throw parseErr;
                }
                tex = parts.map((p) => exprToTex(p.trim(), implicit)).join('=');
            }

            return { 'LaTeX': tex };
        } catch (e) {
            console.error('Error generating LaTeX:', e);
            return { 'LaTeX': '' };
        }
    }
}
