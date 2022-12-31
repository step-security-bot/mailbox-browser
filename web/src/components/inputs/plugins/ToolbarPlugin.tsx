import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
  RangeSelection
} from 'lexical'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $isParentElementRTL,
  $wrapNodes,
  $isAtNodeEnd
} from '@lexical/selection'
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode
} from '@lexical/list'
import { createPortal } from 'react-dom'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode
} from '@lexical/rich-text'
import {
  $createCodeNode,
  $isCodeNode,
  getDefaultCodeLanguage,
  getCodeLanguages
} from '@lexical/code'
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars2Icon,
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
  Bars3Icon,
  Bars4Icon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  LinkIcon,
  ListBulletIcon,
  PencilSquareIcon
} from '@heroicons/react/20/solid'
import { PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline'
import Bars3BottomCenterIcon from '../icons/Bars3BottomCenterIcon'
import ListNumberIcon from '../icons/ListNumberIcon'
import StrikeThroughIcon from '../icons/StrikeThrough'
import BoldIcon from '../icons/BoldIcon'
import ItalicIcon from '../icons/ItalicIcon'
import UnderlineIcon from '../icons/Underline'

const LowPriority = 1

const supportedBlockTypes = new Set([
  'paragraph',
  'quote',
  'code',
  'h1',
  'h2',
  'ul',
  'ol'
])

const blockTypeToBlockName = {
  code: 'Code Block',
  h1: 'Large Heading',
  h2: 'Small Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  ol: 'Numbered List',
  paragraph: 'Normal',
  quote: 'Quote',
  ul: 'Bulleted List'
}

const blockTypeToIcon = {
  code: <CodeBracketIcon />,
  h1: <Bars2Icon />,
  h2: <Bars3Icon />,
  h3: <Bars4Icon />,
  h4: <Bars4Icon />,
  h5: <Bars4Icon />,
  ol: <ListNumberIcon />,
  paragraph: <Bars4Icon />,
  quote: <ChatBubbleBottomCenterTextIcon />,
  ul: <ListBulletIcon />
}

type BlockType = 'code' | 'h1' | 'h2' | 'ol' | 'paragraph' | 'quote' | 'ul'

function Divider() {
  return <div className="w-px mx-2 my-1 bg-neutral-200 dark:bg-neutral-600" />
}

function positionEditorElement(editor: any, rect: any) {
  if (rect === null) {
    editor.style.opacity = '0'
    editor.style.top = '-1000px'
    editor.style.left = '-1000px'
  } else {
    editor.style.opacity = '1'
    editor.style.top = `${rect.top + rect.height + window.pageYOffset + 10}px`
    editor.style.left = `${
      rect.left + window.pageXOffset - editor.offsetWidth / 2 + rect.width / 2
    }px`
  }
}

function FloatingLinkEditor({ editor }: { editor: LexicalEditor }) {
  const editorRef = useRef(null)
  const inputRef = useRef(null)
  const mouseDownRef = useRef(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [isEditMode, setEditMode] = useState(false)
  const [lastSelection, setLastSelection] =
    useState<ReturnType<typeof $getSelection>>(null)

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection)
      const parent = node.getParent()
      if ($isLinkNode(parent)) {
        setLinkUrl(parent.getURL())
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL())
      } else {
        setLinkUrl('')
      }
    }
    const editorElem = editorRef.current
    const nativeSelection = window.getSelection()
    const activeElement = document.activeElement

    if (editorElem === null) {
      return
    }
    if (nativeSelection === null) {
      return
    }

    const rootElement = editor.getRootElement()
    if (
      selection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const domRange = nativeSelection.getRangeAt(0)
      let rect
      if (nativeSelection.anchorNode === rootElement) {
        let inner: Element = rootElement
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild
        }
        rect = inner.getBoundingClientRect()
      } else {
        rect = domRange.getBoundingClientRect()
      }

      if (!mouseDownRef.current) {
        positionEditorElement(editorElem, rect)
      }
      setLastSelection(selection)
    } else if (
      !activeElement ||
      !activeElement.className.includes('link-input')
    ) {
      positionEditorElement(editorElem, null)
      setLastSelection(null)
      setEditMode(false)
      setLinkUrl('')
    }

    return true
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditor()
        })
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor()
          return true
        },
        LowPriority
      )
    )
  }, [editor, updateLinkEditor])

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateLinkEditor()
    })
  }, [editor, updateLinkEditor])

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      const input: any = inputRef.current
      input.focus()
    }
  }, [isEditMode])

  return (
    <div
      ref={editorRef}
      className="absolute z-50 -mt-[6px] max-w-[300px] w-full opacity-0 bg-white shadow rounded-md transition-opacity duration-300 p-2"
    >
      {isEditMode ? (
        <input
          ref={inputRef}
          className="link-input block w-full outline-none"
          value={linkUrl}
          onChange={(event) => {
            setLinkUrl(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (lastSelection !== null) {
                if (linkUrl !== '') {
                  editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl)
                }
                setEditMode(false)
              }
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setEditMode(false)
            }
          }}
        />
      ) : (
        <>
          <div className="link-input block w-full">
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 no-underline hover:underline block whitespace-nowrap overflow-hidden mr-4"
            >
              {linkUrl}
            </a>
            <div
              className="absolute right-0 top-0 bottom-0 px-2 flex items-center justify-center cursor-pointer"
              role="button"
              tabIndex={0}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setEditMode(true)
              }}
            >
              <PencilSquareIcon className="w-4 h-4 text-neutral-500" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type SelectProps = {
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  className: string
  options: string[]
  value: string
}

function Select({ onChange, className, options, value }: SelectProps) {
  return (
    <select className={className} onChange={onChange} value={value}>
      <option hidden={true} value="" />
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function getSelectedNode(selection: RangeSelection) {
  const anchor = selection.anchor
  const focus = selection.focus
  const anchorNode = selection.anchor.getNode()
  const focusNode = selection.focus.getNode()
  if (anchorNode === focusNode) {
    return anchorNode
  }
  const isBackward = selection.isBackward()
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode
  }
}

type BlockOptionsDropdownListProps = {
  editor: LexicalEditor
  blockType: string
  toolbarRef: React.RefObject<HTMLDivElement>
  setShowBlockOptionsDropDown: (show: boolean) => void
}

function BlockOptionsDropdownList({
  editor,
  blockType,
  toolbarRef,
  setShowBlockOptionsDropDown
}: BlockOptionsDropdownListProps) {
  const dropDownRef = useRef(null)

  useEffect(() => {
    const toolbar = toolbarRef.current
    const dropDown: any = dropDownRef.current

    if (toolbar !== null && dropDown !== null) {
      const { left } = toolbar.getBoundingClientRect()
      dropDown.style.bottom = `${120}px`
      dropDown.style.left = `${left + 112}px`
    }
  }, [dropDownRef, toolbarRef])

  useEffect(() => {
    const dropDown: any = dropDownRef.current
    const toolbar = toolbarRef.current

    if (dropDown !== null && toolbar !== null) {
      const handle = (event: any) => {
        const target = event.target

        if (!dropDown.contains(target) && !toolbar.contains(target)) {
          setShowBlockOptionsDropDown(false)
        }
      }
      document.addEventListener('click', handle)

      return () => {
        document.removeEventListener('click', handle)
      }
    }
  }, [dropDownRef, setShowBlockOptionsDropDown, toolbarRef])

  const formatParagraph = () => {
    if (blockType !== 'paragraph') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createParagraphNode())
        }
      })
    }
    setShowBlockOptionsDropDown(false)
  }

  const formatLargeHeading = () => {
    if (blockType !== 'h1') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode('h1'))
        }
      })
    }
    setShowBlockOptionsDropDown(false)
  }

  const formatSmallHeading = () => {
    if (blockType !== 'h2') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createHeadingNode('h2'))
        }
      })
    }
    setShowBlockOptionsDropDown(false)
  }

  const formatBulletList = () => {
    if (blockType !== 'ul') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
    setShowBlockOptionsDropDown(false)
  }

  const formatNumberedList = () => {
    if (blockType !== 'ol') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
    setShowBlockOptionsDropDown(false)
  }

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createQuoteNode())
        }
      })
    }
    setShowBlockOptionsDropDown(false)
  }

  const formatCode = () => {
    if (blockType !== 'code') {
      editor.update(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          $wrapNodes(selection, () => $createCodeNode())
        }
      })
    }
    setShowBlockOptionsDropDown(false)
  }

  const blockTypeList: [string, string, () => void, ReactElement][] = [
    ['paragraph', 'Normal', formatParagraph, <Bars4Icon />],
    ['large-heading', 'Large Heading', formatLargeHeading, <Bars2Icon />],
    ['small-heading', 'Small Heading', formatSmallHeading, <Bars3Icon />],
    ['bullet-list', 'Bullet List', formatBulletList, <ListBulletIcon />],
    ['numbered-list', 'Numbered List', formatNumberedList, <ListNumberIcon />],
    ['quote', 'Quote', formatQuote, <ChatBubbleBottomCenterTextIcon />],
    ['code', 'Code', formatCode, <CodeBracketIcon />]
  ]

  return (
    <div
      className="z-10 block absolute rounded-md cursor-pointer min-w-32 min-h-10 shadow-md bg-white dark:bg-neutral-600 text-slate-800 dark:text-slate-200"
      ref={dropDownRef}
    >
      {blockTypeList.map(([blockClass, blockName, format, element]) => {
        return (
          <button
            key={blockClass}
            className="p-2 flex flex-row shrink-0 content-center rounded-md min-w-32 hover:bg-neutral-200 dark:hover:bg-neutral-500"
            onClick={format}
          >
            <span className="mr-2 self-center w-4 h-4">{element}</span>
            <span className="flex flex-1 leading-5 w-48">{blockName}</span>
          </button>
        )
      })}
    </div>
  )
}

interface ToolbarPluginProps {
  handleSend: () => void
  handleDelete: () => void
}

export default function ToolbarPlugin(props: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext()
  const toolbarRef = useRef(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [blockType, setBlockType] = useState('paragraph')
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(
    null
  )
  const [showBlockOptionsDropDown, setShowBlockOptionsDropDown] =
    useState(false)
  const [codeLanguage, setCodeLanguage] = useState('')
  const [isRTL, setIsRTL] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isCode, setIsCode] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode()
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow()
      const elementKey = element.getKey()
      const elementDOM = editor.getElementByKey(elementKey)
      if (elementDOM !== null) {
        setSelectedElementKey(elementKey)
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getTag() : element.getTag()
          setBlockType(type)
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType()
          setBlockType(type)
          if ($isCodeNode(element)) {
            setCodeLanguage(element.getLanguage() || getDefaultCodeLanguage())
          }
        }
      }
      // Update text format
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
      setIsCode(selection.hasFormat('code'))
      setIsRTL($isParentElementRTL(selection))

      // Update links
      const node = getSelectedNode(selection)
      const parent = node.getParent()
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true)
      } else {
        setIsLink(false)
      }
    }
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          updateToolbar()
          return false
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload)
          return false
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload)
          return false
        },
        LowPriority
      )
    )
  }, [editor, updateToolbar])

  const codeLanguges = useMemo(() => getCodeLanguages(), [])
  const onCodeLanguageSelect = useCallback(
    (e: any) => {
      editor.update(() => {
        if (selectedElementKey !== null) {
          const node = $getNodeByKey(selectedElementKey)
          if ($isCodeNode(node)) {
            node.setLanguage(e.target.value)
          }
        }
      })
    },
    [editor, selectedElementKey]
  )

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://')
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
  }, [editor, isLink])

  return (
    <div
      className="toolbar flex py-1 px-1 mt-2 -mx-2 rounded-b md:rounded-b-md bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
      ref={toolbarRef}
    >
      <button
        onClick={() => {
          props.handleSend()
        }}
        className="inline-flex bg-blue-200 text-black pl-5 pr-4 space-x-2 rounded-md items-center cursor-pointer border-0"
        aria-label="Send"
      >
        <span>Send</span>
        <span>
          <PaperAirplaneIcon className="w-4 h-4 self-center" />
        </span>
      </button>

      <Divider />

      <button
        disabled={!canUndo}
        onClick={() => {
          editor.dispatchCommand(UNDO_COMMAND, undefined)
        }}
        className="flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Undo"
      >
        <ArrowUturnLeftIcon className="w-4 h-4 self-center" />
      </button>
      <button
        disabled={!canRedo}
        onClick={() => {
          editor.dispatchCommand(REDO_COMMAND, undefined)
        }}
        className="flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Redo"
      >
        <ArrowUturnRightIcon className="w-4 h-4 self-center" />
      </button>
      <Divider />
      {supportedBlockTypes.has(blockType) && (
        <>
          <button
            className="flex px-2.5 items-center rounded-md cursor-pointer w-36 enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 block-controls"
            onClick={() =>
              setShowBlockOptionsDropDown(!showBlockOptionsDropDown)
            }
            aria-label="Formatting Options"
          >
            <span className="w-4 h-4">
              {blockTypeToIcon[blockType as BlockType]}
            </span>
            <span className="flex-1 ml-2 text-sm text-inherit w-16 h-5 leading-5 text-left">
              {blockTypeToBlockName[blockType as BlockType]}
            </span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          {showBlockOptionsDropDown &&
            createPortal(
              <BlockOptionsDropdownList
                editor={editor}
                blockType={blockType}
                toolbarRef={toolbarRef}
                setShowBlockOptionsDropDown={setShowBlockOptionsDropDown}
              />,
              document.body
            )}
          <Divider />
        </>
      )}
      {blockType === 'code' ? (
        <span className="flex">
          <Select
            className="p-2 rounded-md align-middle cursor-pointer select-none outline-none text-neutral-500 bg-transparent dark:hover:bg-neutral-600 dark:text-neutral-200 text-sm capitalize w-32"
            onChange={onCodeLanguageSelect}
            options={codeLanguges}
            value={codeLanguage}
          />
          <ChevronDownIcon className="w-4 h-4 -ml-5 self-center" />
        </span>
      ) : (
        <>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
            }}
            className={
              'flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 ' +
              (isBold ? 'bg-neutral-200 dark:bg-neutral-600' : '')
            }
            aria-label="Format Bold"
          >
            <BoldIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
            }}
            className={
              'flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 ' +
              (isItalic ? 'bg-neutral-200 dark:bg-neutral-600' : '')
            }
            aria-label="Format Italics"
          >
            <ItalicIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
            }}
            className={
              'flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 ' +
              (isUnderline ? 'bg-neutral-200 dark:bg-neutral-600' : '')
            }
            aria-label="Format Underline"
          >
            <UnderlineIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
            }}
            className={
              'flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 ' +
              (isStrikethrough ? 'bg-neutral-200 dark:bg-neutral-600' : '')
            }
            aria-label="Format Strikethrough"
          >
            <StrikeThroughIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
            }}
            className={
              'flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 ' +
              (isCode ? 'bg-neutral-200 dark:bg-neutral-600' : '')
            }
            aria-label="Insert Code"
          >
            <CodeBracketIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={insertLink}
            className={
              'flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600 ' +
              (isLink ? 'bg-neutral-200 dark:bg-neutral-600' : '')
            }
            aria-label="Insert Link"
          >
            <LinkIcon className="w-4 h-4 self-center" />
          </button>
          {isLink &&
            createPortal(<FloatingLinkEditor editor={editor} />, document.body)}
          <Divider />
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')
            }}
            className="flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600"
            aria-label="Left Align"
          >
            <Bars3BottomLeftIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')
            }}
            className="flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600"
            aria-label="Center Align"
          >
            <Bars3BottomCenterIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')
            }}
            className="flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600"
            aria-label="Right Align"
          >
            <Bars3BottomRightIcon className="w-4 h-4 self-center" />
          </button>
          <button
            onClick={() => {
              editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')
            }}
            className="flex p-2.5 rounded-md enabled:hover:bg-neutral-300 dark:enabled:hover:bg-neutral-600"
            aria-label="Justify Align"
          >
            <Bars3Icon className="w-4 h-4 self-center" />
          </button>{' '}
        </>
      )}

      <button
        onClick={() => {
          props.handleDelete()
        }}
        className="p-2.5 ml-auto rounded-md align-middle cursor-pointer hover:bg-red-300 dark:hover:bg-red-600"
        aria-label="Trash"
      >
        <TrashIcon className="w-4 h-4 self-center" />
      </button>
    </div>
  )
}
