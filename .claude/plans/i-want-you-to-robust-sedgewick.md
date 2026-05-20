# Plan: Custom Validator Function on Argument Interface

## Context

Currently, argument validation is limited to built-in checks (type, allowable
values, min/max range). There is no way for command authors to define custom
validation logic -- for example, ensuring array values are unique. This change
adds an optional `validate` callback to the `Argument` interface that runs after
built-in validation passes, enabling arbitrary custom checks.

## Task List

-
  1. [x] Add `validate` property to `Argument` interface
-
  2. [x] Add `CUSTOM_VALIDATION` to `InvalidArgumentReason` enum and `message`
         field to `InvalidArgument`
-
  3. [x] Invoke custom validator in `argumentValueValidation.ts` (two insertion
         points + getInvalidArgumentString)
-
  4. [x] Add tests in `argumentValueValidation.test.ts`
-
  5. [x] Update `README.md` Value Validation section
-
  6. [x] Run tests and typecheck

## Changes

### 1. `src/api/argument/Argument.ts`

Add import for `ArgumentValueType` and `ArgumentValues` (line 1-4), then add
after `configurationKey` property:

````typescript
import type {
  ArgumentSingleValueType,
  ArgumentValueType,
  ArgumentValueTypeName,
  ArgumentValues,
} from "./ArgumentValueTypes.ts";

// ... existing properties ...

  /**
   * Optional custom validation function invoked after all built-in validation
   * has passed. Receives the validated and type-converted value.
   *
   * Return `undefined` if the value is valid, or a string describing the
   * validation error. The error string is associated with
   * {@link InvalidArgumentReason.CUSTOM_VALIDATION}.
   *
   * Example: ensure array values are unique:
   * ```typescript
   * validate: (value) => {
   *   const arr = value as string[];
   *   return new Set(arr).size !== arr.length
   *     ? "values must be unique"
   *     : undefined;
   * }
   * ```
   */
  readonly validate?: (
    value: ArgumentValueType | ArgumentValues | Array<ArgumentValues>,
  ) => string | undefined;
````

Note: `ArgumentSingleValueType` and `ArgumentValueTypeName` are already
imported. Need to add `ArgumentValueType` and `ArgumentValues`.

### 2. `src/api/RunResult.ts`

**Add to `InvalidArgumentReason` enum** (after `OPTION_IS_COMPLEX = 8`):

```typescript
/**
 * The value failed a custom validation function defined on the argument.
 */
CUSTOM_VALIDATION = 9,
```

**Add to `InvalidArgument` interface** (new optional field):

```typescript
/**
 * An optional message providing detail about the validation failure.
 * Populated when {@link reason} is {@link InvalidArgumentReason.CUSTOM_VALIDATION}.
 */
readonly message?: string;
```

### 3. `src/runtime/values/argumentValueValidation.ts`

**3a. In `doSubCommandArgumentValidation`** -- after the
`if (validationResult.invalidArgument)` block (line 468-469) and before the
return at line 471, insert custom validation:

```typescript
// run custom validator if defined and built-in validation passed
if (argument.validate && validationResult.validValue !== undefined) {
  const customError = argument.validate(
    validationResult.validValue as
      | ArgumentValueType
      | ArgumentValues
      | Array<ArgumentValues>,
  );
  if (customError !== undefined) {
    invalidArguments.push({
      argument,
      name: argument.name,
      value: validationResult.validValue as PopulatedArgumentValueType,
      reason: InvalidArgumentReason.CUSTOM_VALIDATION,
      message: customError,
    });
    return undefined;
  }
}
return validationResult.validValue as
  | PopulatedArgumentValueType
  | PopulatedArgumentValues
  | undefined;
```

**3b. In `validateGlobalCommandArgumentValue`** -- before the return at line
577, insert:

```typescript
if (
  globalCommandArgument.validate && validationResult.validValue !== undefined
) {
  const customError = globalCommandArgument.validate(
    validationResult.validValue as ArgumentValueType,
  );
  if (customError !== undefined) {
    invalidArguments.push({
      argument: globalCommandArgument,
      name: globalCommand.name,
      value: validationResult.validValue,
      reason: InvalidArgumentReason.CUSTOM_VALIDATION,
      message: customError,
    });
    return undefined;
  }
}
return validationResult.validValue as PopulatedArgumentSingleValueType;
```

**3c. In `getInvalidArgumentString`** -- add case before `default:`:

```typescript
case InvalidArgumentReason.CUSTOM_VALIDATION:
  invalidString = invalidArgument.message
    ? `(custom validation: ${invalidArgument.message})`
    : "(custom validation failed)";
  break;
```

### 4. `tests/runtime/values/argumentValueValidation.test.ts`

Add these tests within the existing describe block:

1. **"Option with custom validator that passes"** -- STRING option with
   `validate: () => undefined`, valid value returns normally
2. **"Option with custom validator that fails"** -- STRING option with
   `validate: (v) => (v as string).length < 3 ? "min 3 chars" : undefined`,
   value `"ab"` fails with CUSTOM_VALIDATION + message
3. **"Positional with custom validator that passes and fails"** -- NUMBER
   positional with
   `validate: (v) => (v as number) % 2 !== 0 ? "must be even" : undefined`
4. **"GlobalCommand argument with custom validator that passes and fails"** --
   STRING argument with validator
5. **"Option isArray with custom validator checking uniqueness"** -- STRING
   array option with
   `validate: (v) => { const arr = v as string[]; return new Set(arr).size !== arr.length ? "values must be unique" : undefined; }`.
   Test `["a", "b", "a"]` fails, `["a", "b", "c"]` passes
6. **"Positional isVarargMultiple with custom validator checking uniqueness"**
   -- NUMBER vararg positional with uniqueness check. `["1", "2", "1"]`
   (converts to `[1, 2, 1]`) fails, `["1", "2", "3"]` passes
7. **"Custom validator not called when built-in validation fails"** -- NUMBER
   option with validate that throws, value `"foo"` triggers
   INCORRECT_VALUE_TYPE, not CUSTOM_VALIDATION
8. **"Custom validator not called when value is undefined and optional"** --
   optional STRING option with validate that throws, value `undefined`, no
   errors

### 5. `README.md`

After the "Option Is Complex" bullet at line 828, add:

```markdown
- **Custom Validation**: If the argument defines a custom `validate` function
  and the value (after passing all built-in validations) fails the custom
  validation check. The error message provided by the custom validator is
  included in the error output.
```

## Verification

1. `bun test` -- all existing + new tests pass
2. `deno fmt` -- formatting check
3. `deno lint index.ts src/ tests/` -- lint check

## Critical Files

- `src/api/argument/Argument.ts` -- interface change
- `src/api/RunResult.ts` -- enum + interface change
- `src/runtime/values/argumentValueValidation.ts` -- validation logic
- `tests/runtime/values/argumentValueValidation.test.ts` -- new tests
- `README.md` -- documentation
