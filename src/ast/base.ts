const childFieldsMap = new WeakMap<any, string[]>();

function addChildFields(target: any, field: string) {
    let childFields = childFieldsMap.get(target);
    if (childFields == null) {
        childFields = [];
        childFieldsMap.set(target, childFields);
    }
    childFields.push(field);
}

export function* allChildFields(target: any) {
    while (target != null && target !== AstNode && target !== Function) {
        const childFields = childFieldsMap.get(target) ?? [];
        yield* childFields;
        target = Object.getPrototypeOf(target);
    }
}

// ast
export abstract class AstNode {
    parent: AstNode | null;

    constructor() {
        this.parent = null;
    }

    replaceChild<T extends AstNode>(before: AstNode, after: T): T {
        for (let field of allChildFields(this)) {
            if ((this as any)[field] === before) {
                after.parent = this;
                (this as any)[field] = after;
                return after;
            }
        }
        throw new Error('이 노드의 자식이 아닙니다.');
    }

    replace<T extends AstNode>(after: T): T {
        if (this.parent === null) {
            throw new Error('부모가 없습니다.');
        }
        return this.parent.replaceChild(this, after);
    }
}

export function child(target: any, field: string): any {
    addChildFields(target, field);
    const privateField = '_' + field;
    return {
        configurable: true,
        enumerable: false,
        get: function (this: any) {
            let member = this[privateField];
            return member ? member : null;
        },
        set: function (this: any, value: any) {
            if (value != null) {
                value.parent = this;
            }
            this[privateField] = value;
        }
    };
}

const listField = Symbol('listField');

export abstract class AstListMixin<T extends AstNode = AstNode> {
    [listField]: (T | null)[];

    get length() {
        return this[listField].length;
    }

    push(childNode: T | null) {
        if (childNode != null) {
            childNode.parent = this as any;
        }
        this[listField].push(childNode);
    }

    [Symbol.iterator]() {
        return this[listField][Symbol.iterator]();
    }

    replaceChild<T extends AstNode>(before: AstNode, after: T): T {
        let index = this[listField].indexOf(before as any);
        if (index === -1) {
            throw new Error('이 노드의 자식이 아닙니다.');
        }
        if (isSameType(after, this)) { // after가 목록인 경우
            for (let child of after[listField]) {
                if (child != null) {
                    child.parent = this as any;
                }
            }
            this[listField].splice(index, 1, ...after[listField]);
            return undefined as any;  // TODO
        } else {
            after.parent = this as any;
            this[listField][index] = after as any;
            return after;
        }
    }

    removeChild(child: T) {
        let index = this[listField].indexOf(child);
        if (index === -1) {
            throw new Error('이 노드의 자식이 아닙니다.');
        }
        this[listField].splice(index, 1);
    }
}

function isSameType<T extends object>(obj: any, other: T): obj is T {
    return obj.constructor === other.constructor;
}

export function astList<T>(listFieldName: string) {
    return function decorator(target: any) {
        Object.defineProperty(target.prototype, listField, {
            configurable: false,
            enumerable: false,
            get() { return this[listFieldName]; }
        });
        applyMixin(target, AstListMixin);
    };
}

function applyMixin(target: any, mixin: any) {
    const properties: (string | symbol)[] = Object.getOwnPropertyNames(mixin.prototype);
    properties.push(...Object.getOwnPropertySymbols(mixin.prototype));
    for (const name of properties) {
        Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(mixin.prototype, name)!);
    }
}

@astList('childNodes')
export abstract class AstNodeList<T extends AstNode = AstNode> extends AstNode {
    childNodes: T[];

    constructor() {
        super();
        this.childNodes = [];
    }
}
export interface AstNodeList<T> extends AstListMixin<T> {}
