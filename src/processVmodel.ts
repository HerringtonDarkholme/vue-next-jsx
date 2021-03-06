import * as bt from '@babel/types'
import { NodePath } from '@babel/traverse'
import { FinallyExpression, TagType, AttributePaths } from './buildCreateVNode'
import { State } from './main'
import { throwError, ErrorCodes } from './errors'

export const vmodelRE = /^v-model/

const dirMap = {
  V_MODEL_TEXT: 'vModelText',
  V_MODEL_RADIO: 'vModelRadio',
  V_MODEL_CHECKBOX: 'vModelCheckbox',
  V_MODEL_DYNAMIC: 'vModelDynamic',
  V_MODEL_SELECT: 'vModelSelect'
}

export function buildPropsForVmodel(
  attr: bt.JSXAttribute,
  attrPath: NodePath<bt.JSXAttribute>,
  attrPaths: AttributePaths,
  tag: Exclude<TagType, bt.NullLiteral>,
  isComponent: boolean,
  state: State
) {
  if (!bt.isJSXExpressionContainer(attr.value)) {
    throwError(attrPath, ErrorCodes.X_INVALIDE_V_MODEL_VALUE)
  }

  const name = (attr.name as bt.JSXIdentifier).name.replace(vmodelRE, '')

  let propName = name ? name : 'modelValue'
  const modifiers: string[] = []

  if (!name) {
    // v-model={...}
    propName = 'modelValue'
  } else {
    if (name[0] === '_') {
      // v-model_a_b
      propName = 'modelValue'
      modifiers.push(...name.slice(1).split('_'))
    } else if (name[0] !== '-') {
      throwError(attrPath, ErrorCodes.X_INVALIDE_V_MODEL_ARGS)
    } else {
      // v-model-foo_a_b
      const nameArr = name.slice(1).split('_')
      if (!nameArr.length) {
        throwError(attrPath, ErrorCodes.X_MISSING_V_MODEL_ARGS)
      }

      propName = nameArr[0]
      modifiers.push(...nameArr.slice(1))
    }
  }

  const eventName = `onUpdate:${propName}`

  const ret = [
    bt.objectProperty(
      bt.stringLiteral(propName),
      attr.value.expression as FinallyExpression
    ),
    bt.objectProperty(
      bt.stringLiteral(eventName),
      bt.arrowFunctionExpression(
        [bt.identifier('$event')],
        bt.assignmentExpression(
          '=',
          attr.value.expression as bt.LVal,
          bt.identifier('$event')
        )
      )
    )
  ]

  if (modifiers.length && isComponent) {
    ret.push(
      bt.objectProperty(
        bt.stringLiteral(
          propName === 'modelValue' ? 'modelModifiers' : `${propName}Modifiers`
        ),
        bt.objectExpression(
          modifiers.map((m) => {
            return bt.objectProperty(
              bt.stringLiteral(m),
              bt.booleanLiteral(true)
            )
          })
        )
      )
    )
  }

  if (isComponent)
    return {
      ret
    }

  // element: input / select / textarea

  if (propName !== 'modelValue') {
    throwError(attrPath, ErrorCodes.X_V_MODEL_ARG_ON_ELEMENT)
  }

  const tagName = (tag as bt.StringLiteral).value
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    const { directiveToUse, isInvalidType } = resolveDiretiveToUse(
      tagName,
      attrPaths
    )

    if (!isInvalidType) {
      // native vmodel doesn't need the `modelValue` props since they are also
      // passed to the runtime as `binding.value`. removing it reduces code size.
      ret.shift()

      const dirHelper = state.visitorContext.addHelper(directiveToUse)

      const arrayExpArgs: FinallyExpression[] = [
        dirHelper,
        attr.value.expression as FinallyExpression
      ]

      if (modifiers.length) {
        arrayExpArgs.push(
          ...[
            bt.identifier('void 0'),
            bt.objectExpression(
              modifiers.map((m) => {
                return bt.objectProperty(
                  bt.stringLiteral(m),
                  bt.booleanLiteral(true)
                )
              })
            )
          ]
        )
      }

      return {
        ret,
        dirArg: bt.arrayExpression(arrayExpArgs)
      }
    }
  } else {
    throwError(attrPath, ErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT)
  }
}

export function resolveDiretiveToUse(
  tagName: string,
  attrPaths: AttributePaths
) {
  let directiveToUse = dirMap.V_MODEL_TEXT
  let isInvalidType = false
  if (tagName === 'input') {
    const findResult = findProp(attrPaths, 'type')
    if (findResult) {
      const { path, node } = findResult

      if (bt.isJSXExpressionContainer(node.value)) {
        // type={ refType.value }
        directiveToUse = dirMap.V_MODEL_DYNAMIC
      } else if (bt.isStringLiteral(node.value)) {
        switch (node.value.value) {
          case 'radio':
            directiveToUse = dirMap.V_MODEL_RADIO
            break
          case 'checkbox':
            directiveToUse = dirMap.V_MODEL_CHECKBOX
            break
          case 'file':
            isInvalidType = true
            throwError(path, ErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT)
          default:
            // text type
            checkDuplicatedValue(attrPaths)
            break
        }
      }
    } else if (hasDynamicKeyVBind(attrPaths)) {
      // element has bindings with dynamic keys, which can possibly contain
      // "type".
      directiveToUse = dirMap.V_MODEL_DYNAMIC
    } else {
      // text type
      checkDuplicatedValue(attrPaths)
    }
  } else if (tagName === 'select') {
    directiveToUse = dirMap.V_MODEL_SELECT
  } else if (tagName === 'textarea') {
    checkDuplicatedValue(attrPaths)
  }

  return {
    directiveToUse,
    isInvalidType
  }
}

function findProp(attrPaths: AttributePaths, name: string) {
  for (let i = 0; i < attrPaths.length; i++) {
    const attrPath = attrPaths[i]
    if (bt.isJSXAttribute(attrPath.node)) {
      if ((attrPath.node.name as bt.JSXIdentifier).name === name) {
        return {
          path: attrPath,
          node: attrPath.node
        }
      }
    }
  }
}

function checkDuplicatedValue(attrPaths: AttributePaths) {
  const ret = findProp(attrPaths, 'value')
  if (ret) {
    throwError(ret.path, ErrorCodes.X_V_MODEL_UNNECESSARY_VALUE)
  }
}

function hasDynamicKeyVBind(attrPaths: AttributePaths) {
  return attrPaths.some((path) => bt.isJSXSpreadAttribute(path.node))
}
