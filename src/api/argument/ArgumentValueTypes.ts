/**
 * The type of single {@link Argument} values which are supported.
 *
 * NOTE: JavaScript does not have a special runtime value for INTEGER so this is covered by `number`.
 * NOTE: `string` is also used for PASSWORD values.
 */
export type ArgumentSingleValueType = number | string | boolean;

/**
 * The type of the value to be parsed as an argument can be: `boolean`, `number` or `string` or an array of these.
 */
export type ArgumentValueType =
  | ArgumentSingleValueType
  | Array<ArgumentSingleValueType>;

/**
 * A container object for populated argument values.
 *
 * The following are all valid examples:
 *
 * * `{ }`
 * * `{ foo: 1 }`
 * * `{ foo: true }`
 * * `{ foo: 'bar' }`
 * * `{ foo: [ 1, 2 ] }`
 * * `{ foo: [ true, true ] }`
 * * `{ foo: [ 'bar', 'gar' ] }`
 * * `{ foo: { a: 1 } }`
 * * `{ foo: { a: { b: 'c'} } }`
 * * `{ foo: [ { a: { b: 'c'} }, { a: { b: 'c'} } ] }`
 *
 * An array of arrays is not allowed, so the following is an INVALID example:
 *
 * * `{ foo: [ [ 1, 2 ], [3, 4 ] ] }`
 */
export type ArgumentValues = {
  [argName: string]:
    | ArgumentValueType
    | ArgumentValues
    | Array<ArgumentValues>;
};

/**
 * Enum of possible {@link Argument} value types.
 */
export enum ArgumentValueTypeName {
  STRING = 0,
  NUMBER = 1,
  INTEGER = 2,
  BOOLEAN = 3,
  SECRET,
}

/**
 * Only possible value for {@link ComplexOption.type}.
 */
export enum ComplexValueTypeName {
  COMPLEX = 5,
}

/**
 * Populated single value type is very similar to {@link ArgumentSingleValueType} but allows for an illegal
 * undefined value.
 */
export type PopulatedArgumentSingleValueType =
  | ArgumentSingleValueType
  | undefined;

/**
 * Populated argument value types are very similar to {@link ArgumentValueType} but allow for illegal
 * undefined values.
 */
export type PopulatedArgumentValueType =
  | PopulatedArgumentSingleValueType
  | Array<PopulatedArgumentSingleValueType>;

/**
 * Populated values are very similar to {@link ArgumentValues} but allow for illegal
 * undefined properties and array entries.
 */
export interface PopulatedArgumentValues {
  [argName: string]:
    | PopulatedArgumentValueType
    | PopulatedArgumentValues
    | Array<PopulatedArgumentValues | undefined>
    | undefined;
}
