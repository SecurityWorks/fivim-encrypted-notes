import { EditorView } from 'codemirror'
import { t } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { StateEffect } from '@codemirror/state'
import { CN_TEMP_ELE, DomUtils, PopupView, exsied, plugins } from '@exsied/exsied'
import { EventWithElement } from '@exsied/exsied/dist/core/plugin'
import { PluginConf as sourceCodePluginConf } from '@exsied/exsied/dist/plugins/source_code/base'

import { formatHtml } from '@/utils/html'
import { osThemeIsDark } from '@/utils/media_query'

import {
	DEFAULT_DARK_THEME,
	DEFAULT_LIGHT_THEME,
	cmSuppertedLang,
	getLang,
	getThemeByName,
} from '../../CodeMirror/base'
import {
	CodeMirrorOnChange,
	genDefaultThemeOption,
	genExtensions,
	initEditorState,
	initEditorView,
} from '../../CodeMirror/initCodeMirror'
import { highlighCode } from '../highlight'

let editorView: EditorView | null
const CN_CODEMIRROR_RENDER = 'code-mirror-render'

function getExtensions(lang: string, onChange: CodeMirrorOnChange) {
	const defaultThemeOption = genDefaultThemeOption(null, null, null, null, null, null)
	const exts = genExtensions(defaultThemeOption, onChange)

	const theme = osThemeIsDark() ? getThemeByName(DEFAULT_DARK_THEME) : getThemeByName(DEFAULT_LIGHT_THEME)
	exts.push(theme)

	const language = getLang(lang)
	if (language) exts.push(language)
	return exts
}

async function initCodeMirror(str: string, parentEle: HTMLElement, lang: string, onChange: CodeMirrorOnChange) {
	const text = lang === 'html' ? await formatHtml(str) : str
	const state = initEditorState(text, getExtensions(lang, onChange))
	editorView = initEditorView(state, parentEle)
}

export function reconfSourceCode() {
	const sourceCodeConf = plugins.sourceCode.conf as sourceCodePluginConf
	sourceCodeConf.renderDataCb = (ele: HTMLElement) => {
		const lang = ele.getAttribute('lang') || ''
		const res = highlighCode(ele.innerHTML, lang)
		return `<pre><code>${res}</code></pre>`
	}
	sourceCodeConf.editDataCb = (codeEle: HTMLElement, sign: string) => {
		const NAME = 'sourceCodeEditor'
		const ID = `exsied_${NAME}_popup`

		const contentHtml = `
		<div>
			<button class="save-btn"> ${t('Save')}</button>
			<select class="language-seleteor">
				${cmSuppertedLang.map((item) => {
					return `<option>${item}</option>`
				})}
			</select>			
		</div>
		<div class="${CN_CODEMIRROR_RENDER}"></div>
		`

		const ele = PopupView.create({
			id: ID,
			classNames: [CN_TEMP_ELE],
			attrs: { TEMP_EDIT_ID: ID },
			contentClassNames: [NAME],
			contentAttrs: {},
			contentHtml,
			titlebarText: t('Source code editor'),
		})

		ele.style.position = 'absolute'
		ele.style.top = '5vh'
		ele.style.left = '5vw'

		ele.style.height = '90vh'
		ele.style.width = '90vw'

		const lang = codeEle.getAttribute('lang') || ''
		const textContent = codeEle.textContent || ''
		let currentLang = lang
		let newTextContent = textContent

		document.body.appendChild(ele)
		DomUtils.limitElementRect(ele)

		const onChange = (param: string) => {
			newTextContent = param
		}

		const saveBtn = ele.querySelector('.save-btn')
		if (saveBtn) {
			saveBtn.addEventListener('click', () => {
				codeEle.textContent = newTextContent
				const render = plugins.sourceCode.commands['renderCodeEle']
				if (render) {
					const event = new Event('')
					const eventWithElement = {
						...event,
						customElement: codeEle,
					} as EventWithElement

					codeEle.setAttribute('lang', currentLang)

					render(eventWithElement)
				} else {
					console.error("Cannot call sourceCode.commands['renderCodeEle']")
				}

				ele.remove()
			})
		}
		const seleteor = ele.querySelector('.language-seleteor')
		if (seleteor) {
			const seleteorEle = seleteor as HTMLSelectElement
			seleteorEle.value = lang

			seleteor.addEventListener('change', (event) => {
				const target = event.target
				if (target) {
					const targetEle = target as HTMLSelectElement
					const lang = targetEle.value
					if (editorView) {
						currentLang = lang
						const exts = getExtensions(lang, onChange)
						editorView.dispatch({ effects: StateEffect.reconfigure.of(exts) })
					}
				}
			})
		}

		const renderBlk = ele.querySelector(`.${CN_CODEMIRROR_RENDER}`)
		if (renderBlk) {
			initCodeMirror(textContent, renderBlk as HTMLElement, lang, onChange)
		}
	}
	sourceCodeConf.randomCharsCb = () => {
		return uuidv4()
	}

	sourceCodeConf.toggleSourceViewAferInitCb = async (ele) => {
		ele.contentEditable = 'false'
		const htmlStr = exsied.elements.workplace.innerHTML
		initCodeMirror(htmlStr, ele, 'html', (param) => {
			exsied.elements.workplace.innerHTML = param
		})
	}
}
