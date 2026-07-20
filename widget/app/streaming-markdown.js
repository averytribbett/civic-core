/**
 * Stabilize incomplete markdown so marked can parse mid-stream without broken tags.
 * Speculatively closes open fences, inline code, emphasis, and partial links.
 */
;(function (global) {
  function countUnescaped(str, needle) {
    let count = 0
    for (let i = 0; i < str.length; ) {
      if (str[i] === "\\" && i + 1 < str.length) {
        i += 2
        continue
      }
      if (str.startsWith(needle, i)) {
        count++
        i += needle.length
      } else {
        i++
      }
    }
    return count
  }

  /** Count single * not part of ** */
  function countSingleStars(str) {
    let count = 0
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++
        continue
      }
      if (str[i] === "*" && str[i + 1] !== "*") {
        if (i === 0 || str[i - 1] !== "*") count++
      } else if (str[i] === "*" && str[i + 1] === "*") {
        i++
      }
    }
    return count
  }

  function countSingleUnderscores(str) {
    let count = 0
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++
        continue
      }
      if (str[i] === "_" && str[i + 1] !== "_") {
        if (i === 0 || str[i - 1] !== "_") count++
      } else if (str[i] === "_" && str[i + 1] === "_") {
        i++
      }
    }
    return count
  }

  function stabilizeIncompleteMarkdown(raw) {
    if (!raw || typeof raw !== "string") return ""
    let text = raw

    // Incomplete markdown link: [label](url without closing paren
    text = text.replace(/\[([^\]]*)\]\(([^)\n]*)$/g, (_match, label, url) => {
      if (!url.trim()) return label || ""
      return "[" + label + "](" + url + ")"
    })
    // Open [label without ]
    if (/\[[^\]]*$/.test(text)) {
      text = text.replace(/\[([^\]]*)$/, "$1")
    }

    // Fenced code blocks: odd number of ``` means still open
    const fenceMatches = text.match(/^```/gm)
    if (fenceMatches && fenceMatches.length % 2 === 1) {
      if (!text.endsWith("\n")) text += "\n"
      text += "```"
    }

    // Inline code: odd backticks outside fences
    const withoutFences = text.replace(/```[\s\S]*?```/g, "")
    if (countUnescaped(withoutFences, "`") % 2 === 1) {
      text += "`"
    }

    const noCode = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
    if (countUnescaped(noCode, "**") % 2 === 1) {
      text += "**"
    }
    if (countUnescaped(noCode, "__") % 2 === 1) {
      text += "__"
    }
    if (countSingleStars(noCode) % 2 === 1) {
      text += "*"
    }
    if (countSingleUnderscores(noCode) % 2 === 1) {
      text += "_"
    }

    return text
  }

  global.stabilizeIncompleteMarkdown = stabilizeIncompleteMarkdown
})(typeof window !== "undefined" ? window : globalThis)
