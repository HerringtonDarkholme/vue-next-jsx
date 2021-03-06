# vue-next-jsx

[Vue Next JSX Explorer](https://vue-next-jsx.netlify.app/)

![build status](https://github.com/HcySunYang/vue-next-jsx/workflows/test/badge.svg)

*A babel plugin that provides jsx syntax for vue3*

- Supports both `jsx` and `tsx`
- Same behavior as `Vue3 Compiler`
- Fully supports `v-on` / `v-model`
- Support optimizate mode: analyze `PatchFlags`
- Write in Typescript
- Other directives: `v-html` / `v-text`
- Try to minimize the volume of generated code

## Usage

### Installation

```sh
npm install @hcysunyang/babel-plugin-vue-next-jsx -D
# or
yarn add @hcysunyang/babel-plugin-vue-next-jsx -D
```

### Babel Config

```json
{
  "presets": [
    "@babel/env"
  ],
  "plugins": [
    "@hcysunyang/vue-next-jsx"
  ]
}
```

# For typescript users

Please read this thread: [https://github.com/vuejs/jsx/issues/141](https://github.com/vuejs/jsx/issues/141)

For the sake of type hinting and type safety, we recommend using the following syntax:

## vModel

#### Intrinaic Elements

```html
<!-- value -->
<input vModel={ [refVal.value] } />
<!-- value + array modifiers -->
<input vModel={ [refVal.value, ['number', 'trim']] } />
<!-- value + object modifiers -->
<input vModel={ [refVal.value, { number: true }] } />
<!-- modifiers as a variable -->
<input vModel={ [refVal.value, modifiers] } />
```

#### Components

```html
<!-- value -->
<Comp vModel={ [refVal.value] } />
<!-- value + array modifiers -->
<Comp vModel={ [refVal.value, 'modelValue', ['a', 'b']] } />
<!-- value + object modifiers -->
<Comp vModel={ [refVal.value, 'modelValue', { a: true, b: true }] } />
<!-- value + propName -->
<Comp vModel={ [refVal.value, 'foo'] } />
<!-- value + dynamic propName -->
<Comp vModel={ [refVal.value, refName.value] } />
<!-- value + dynamic propName + modifiers -->
<Comp vModel={ [refVal.value, refName.value, ['a', 'b']] } />
<!-- modifiers as a variable -->
<Comp vModel={ [refVal.value, refName.value, modifiers] } />

<div onClick={ handler }></div>
<div onClick={ withModifiers(handler, ['self']) }></div>
```

For type hints, you can check our dts test:

- [intrinaicElements.test-d.tsx](https://github.com/HcySunYang/vue-next-jsx/blob/main/test-dts/intrinaicElements.test-d.tsx).
- [components.test-d.tsx](https://github.com/HcySunYang/vue-next-jsx/blob/main/test-dts/components.test-d.tsx).

#### tsconfig.json

```js
{
  // ...
  "compilerOptions": {
    "types": ["@hcysunyang/babel-plugin-vue-next-jsx"],
  }
  // ...
}
```

# For javascript users

## Event: v-on-eventname_modifier

We often do this in template:

```html
<p v-on:click.stop="handler"></p>
```

In `(j|t)sx`:

```html
<p v-on-click_stop="handler"></p>
```

**`tsx` does not allow to use `:` and `.` as attribute name**

If it is available in the template, it is available in `j/tsx` too， here are some examples:

```html
<div v-on-click_middle={ handler }></div>
<div v-on-click_stop={ handler }></div>
<div v-on-click_right={ handler }></div>
<div v-on-keyup_esc={ handler }></div>

<div v-on={ obj }></div>
```

## v-model-propname_modifier

```html
<input v-model={ refVal.value }/>
<input v-model={ refVal.value } :type={ refType.value }/>
<select v-model={ refVal.value }/>
<textarea v-model={ refVal.value }/>
```

`v-model` in the component:

```html
<Comp v-model-foo_a={ refVal.value }/>
```

The generated code is:

```js
createVNode(Comp, {
  "foo": ref.val,
  "onUpdate:foo": $event => ref.val = $event,
  "fooModifiers": {
    "a": true,
    "b": true
  }
})
```

This is consistent with Vue3 Compiler behavior.

## v-bind

In fact, we don't need `v-bind` in `(j|t)sx`, we can use `jsxExpressionContainer` and `jsxSpreadAttribute` directly:

```html
<Comp foo={ refVal.value } { ...props } bar="bar" />
```

The generated code is:

```js
const el = createVNode(Comp,
  mergeProps(
    { foo: refVal.value },
    { ...props },
    { bar: "bar" }
  )
)
```

## slots

I don’t want to support `v-slot`. One of the most important reasons is that in `tsx`: the type of scopedSlot is lost. It is recommended to do this(*and this is the only way*):

```js
const App = {
  setup() {

    return () => {

      const slots = {
        default: () => [ <p>default</p> ],
        foo: ({ val }) => [ <p>{ val }</p> ]
      }

      return <Comp>{ slots }</Comp>

    }
  }
}
```

### KeepAlive And Teleport

In Vue3, the children of KeepAlive and Teleport components will not be built as `slots`, so you can use them as in the template:

## Fragment

Since Vue3 supports multiple root elements, so we need to support `Fragment`:

```html
<>
  <p>foo</p>
  <div>bar</div>
</>
```

## Optimization mode

`Vue3` makes full use of compile-time information to generate `PatchFlags` for runtime update performance improvement, `vue-next-jsx` behaves as `Vue3 Compiler` after enabling **optimization mode**.

In the `babel.config.json` file:

```json
{
  "presets": [
    "@babel/env"
  ],
  "plugins": [
    ["@hcysunyang/vue-next-jsx", {
      // Enabling optimization mode
      "optimizate": true
    }]
  ]
}
```

## Specify source

If you install `vue` instead of `@vue/runtime-dom` then you don’t need to do anything, but if you install `@vue/runtime-dom`, then you need to specify `source`:

```js
{
  "presets": [
    "@babel/env"
  ],
  "plugins": [
    ["@hcysunyang/vue-next-jsx", {
      // Specify source
      "source": "@vue/runtime-dom"
    }]
  ]
}
```

## v-html / v-text

Just like using them in template:

```html
<p v-html={ refHtml.value }></p>
<p v-text={ refText.value }></p>
```

## Other Directives

Supported:

- `v-show`

```html
<p v-show={ refVal.value }></p>
```