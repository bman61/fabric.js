fabric.util.object.extend(fabric.IText.prototype, /** @lends fabric.IText.prototype */ {

  /**
   * Initializes hidden textarea (needed to bring up keyboard in iOS)
   */
  initHiddenTextarea: function() {
    this.hiddenTextarea = fabric.document.createElement('textarea');
    this.hiddenTextarea.setAttribute('autocapitalize', 'off');
    var style = this._calcTextareaPosition();
    this.hiddenTextarea.style.cssText = 'position: absolute; top: ' + style.top + '; left: ' + style.left + ';'
                                        + ' opacity: 0; width: 0px; height: 0px; z-index: -999;';
    fabric.document.body.appendChild(this.hiddenTextarea);

    fabric.util.addListener(this.hiddenTextarea, 'keydown', this.onKeyDown.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'keyup', this.onKeyUp.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'input', this.onInput.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'copy', this.copy.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'cut', this.cut.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'paste', this.paste.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'compositionstart', this.onCompositionStart.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'compositionupdate', this.onCompositionUpdate.bind(this));
    fabric.util.addListener(this.hiddenTextarea, 'compositionend', this.onCompositionEnd.bind(this));

    if (!this._clickHandlerInitialized && this.canvas) {
      fabric.util.addListener(this.canvas.upperCanvasEl, 'click', this.onClick.bind(this));
      this._clickHandlerInitialized = true;
    }
  },

  /**
   * @private
   */
  _keysMap: {
    8:  'removeChars',
    9:  'exitEditing',
    27: 'exitEditing',
    13: 'insertNewline',
    33: 'moveCursorUp',
    34: 'moveCursorDown',
    35: 'moveCursorRight',
    36: 'moveCursorLeft',
    37: 'moveCursorLeft',
    38: 'moveCursorUp',
    39: 'moveCursorRight',
    40: 'moveCursorDown',
    46: 'forwardDelete'
  },

  /**
   * @private
   */
  _ctrlKeysMapUp: {
    67: 'copy',
    88: 'cut'
  },

  /**
   * @private
   */
  _ctrlKeysMapDown: {
    65: 'selectAll'
  },

  onClick: function() {
    // No need to trigger click event here, focus is enough to have the keyboard appear on Android
    this.hiddenTextarea && this.hiddenTextarea.focus();
  },

  /**
   * Handles keyup event
   * @param {Event} e Event object
   */
  onKeyDown: function(e) {
    if (!this.isEditing) {
      return;
    }
    if (e.keyCode in this._keysMap) {
      this[this._keysMap[e.keyCode]](e);
    }
    else if ((e.keyCode in this._ctrlKeysMapDown) && (e.ctrlKey || e.metaKey)) {
      this[this._ctrlKeysMapDown[e.keyCode]](e);
    }
    else {
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    this.canvas && this.canvas.renderAll();
  },

  /**
   * Handles keyup event
   * We handle KeyUp because ie11 and edge have difficulties copy/pasting
   * if a copy/cut event fired, keyup is dismissed
   * @param {Event} e Event object
   */
  onKeyUp: function(e) {
    if (!this.isEditing || this._copyDone) {
      this._copyDone = false;
      return;
    }
    if ((e.keyCode in this._ctrlKeysMapUp) && (e.ctrlKey || e.metaKey)) {
      this[this._ctrlKeysMapUp[e.keyCode]](e);
    }
    else {
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    this.canvas && this.canvas.renderAll();
  },

  /**
   * Handles onInput event
   * @param {Event} e Event object
   */
  onInput: function(e) {
    if (!this.isEditing || this.inCompositionMode) {
      return;
    }
    var offset = this.selectionStart || 0,
        offsetEnd = this.selectionEnd || 0,
        textLength = this.text.length,
        newTextLength = this.hiddenTextarea.value.length,
        diff, charsToInsert, start;
    if (newTextLength > textLength) {
      //we added some character
      start = this._selectionDirection === 'left' ? offsetEnd : offset;
      diff = newTextLength - textLength;
      charsToInsert = this.hiddenTextarea.value.slice(start, start + diff);
    }
    else {
      //we selected a portion of text and then input something else.
      //Internet explorer does not trigger this else
      diff = newTextLength - textLength + offsetEnd - offset;
      charsToInsert = this.hiddenTextarea.value.slice(offset, offset + diff);
    }
    this.insertChars(charsToInsert);
    e.stopPropagation();
  },

  /**
   * Composition start
   */
  onCompositionStart: function() {
    this.inCompositionMode = true;
    this.prevCompositionLength = 0;
    this.compositionStart = this.selectionStart;
  },

  /**
   * Composition end
   */
  onCompositionEnd: function() {
    this.inCompositionMode = false;
  },

  /**
   * Composition update
   */
  onCompositionUpdate: function(e) {
    var data = e.data;
    this.selectionStart = this.compositionStart;
    this.selectionEnd = this.selectionEnd === this.selectionStart ?
      this.compositionStart + this.prevCompositionLength : this.selectionEnd;
    this.insertChars(data, false);
    this.prevCompositionLength = data.length;
  },

  /**
   * Forward delete
   */
  forwardDelete: function(e) {
    if (this.selectionStart === this.selectionEnd) {
      if (this.selectionStart === this.text.length) {
        return;
      }
      this.moveCursorRight(e);
    }
    this.removeChars(e);
  },

  /**
   * Copies selected text
   * @param {Event} e Event object
   */
  copy: function(e) {
    if (this.selectionStart === this.selectionEnd) {
      //do not cut-copy if no selection
      return;
    }
    var selectedText = this.getSelectedText(),
        clipboardData = this._getClipboardData(e);

    // Check for backward compatibility with old browsers
    if (clipboardData) {
      clipboardData.setData('text', selectedText);
    }

    fabric.copiedText = selectedText;
    fabric.copiedTextStyle = this.getSelectionStyles(
                          this.selectionStart,
                          this.selectionEnd);
    e.stopImmediatePropagation();
    e.preventDefault();
    this._copyDone = true;
  },

  /**
   * Pastes text
   * @param {Event} e Event object
   */
  paste: function(e) {
    var copiedText = null,
        clipboardData = this._getClipboardData(e),
        useCopiedStyle = true;

    // Check for backward compatibility with old browsers
    if (clipboardData) {
      copiedText = clipboardData.getData('text').replace(/\r/g, '');
      if (!fabric.copiedTextStyle || fabric.copiedText !== copiedText) {
        useCopiedStyle = false;
      }
    }
    else {
      copiedText = fabric.copiedText;
    }

    if (copiedText) {
      this.insertChars(copiedText, useCopiedStyle);
    }
    e.stopImmediatePropagation();
    e.preventDefault();
  },

  /**
   * Cuts text
   * @param {Event} e Event object
   */
  cut: function(e) {
    if (this.selectionStart === this.selectionEnd) {
      return;
    }

    this.copy(e);
    this.removeChars(e);
  },

  /**
   * @private
   * @param {Event} e Event object
   * @return {Object} Clipboard data object
   */
  _getClipboardData: function(e) {
    return (e && e.clipboardData) || fabric.window.clipboardData;
  },

  /**
   * Gets start offset of a selection
   * @param {Event} e Event object
   * @param {Boolean} isRight
   * @return {Number}
   */
  getDownCursorOffset: function(e, isRight) {
    var selectionProp = isRight ? this.selectionEnd : this.selectionStart,
        cursorLocation = this.get2DCursorLocation(selectionProp),
        _char, lineLeftOffset, lineIndex = cursorLocation.lineIndex,
        textOnSameLineBeforeCursor = this._textLines[lineIndex].slice(0, cursorLocation.charIndex),
        textOnSameLineAfterCursor = this._textLines[lineIndex].slice(cursorLocation.charIndex),
        textOnNextLine = this._textLines[lineIndex + 1] || '';

    // if on last line, down cursor goes to end of line
    if (lineIndex === this._textLines.length - 1 || e.metaKey || e.keyCode === 34) {

      // move to the end of a text
      return this.text.length - selectionProp;
    }

    var widthOfSameLineBeforeCursor = this._getLineWidth(this.ctx, lineIndex);
    lineLeftOffset = this._getLineLeftOffset(widthOfSameLineBeforeCursor);

    var widthOfCharsOnSameLineBeforeCursor = lineLeftOffset;

    for (var i = 0, len = textOnSameLineBeforeCursor.length; i < len; i++) {
      _char = textOnSameLineBeforeCursor[i];
      widthOfCharsOnSameLineBeforeCursor += this._getWidthOfChar(this.ctx, _char, lineIndex, i);
    }

    var indexOnNextLine = this._getIndexOnNextLine(
      cursorLocation, textOnNextLine, widthOfCharsOnSameLineBeforeCursor);

    return textOnSameLineAfterCursor.length + 1 + indexOnNextLine;
  },

  /**
   * @private
   */
  _getIndexOnNextLine: function(cursorLocation, textOnNextLine, widthOfCharsOnSameLineBeforeCursor) {
    var lineIndex = cursorLocation.lineIndex + 1,
        widthOfNextLine = this._getLineWidth(this.ctx, lineIndex),
        lineLeftOffset = this._getLineLeftOffset(widthOfNextLine),
        widthOfCharsOnNextLine = lineLeftOffset,
        indexOnNextLine = 0,
        foundMatch;

    for (var j = 0, jlen = textOnNextLine.length; j < jlen; j++) {

      var _char = textOnNextLine[j],
          widthOfChar = this._getWidthOfChar(this.ctx, _char, lineIndex, j);

      widthOfCharsOnNextLine += widthOfChar;

      if (widthOfCharsOnNextLine > widthOfCharsOnSameLineBeforeCursor) {

        foundMatch = true;

        var leftEdge = widthOfCharsOnNextLine - widthOfChar,
            rightEdge = widthOfCharsOnNextLine,
            offsetFromLeftEdge = Math.abs(leftEdge - widthOfCharsOnSameLineBeforeCursor),
            offsetFromRightEdge = Math.abs(rightEdge - widthOfCharsOnSameLineBeforeCursor);

        indexOnNextLine = offsetFromRightEdge < offsetFromLeftEdge ? j + 1 : j;

        break;
      }
    }

    // reached end
    if (!foundMatch) {
      indexOnNextLine = textOnNextLine.length;
    }

    return indexOnNextLine;
  },

  /**
   * Moves cursor down
   * @param {Event} e Event object
   */
  moveCursorDown: function(e) {
    if (this.selectionStart >= this.text.length && this.selectionEnd >= this.text.length) {
      return;
    }
    this._moveCursorUpOrDown('Down', e);
  },

  /**
   * Moves cursor down without keeping selection
   * @param {Number} offset
   */
  moveCursorDownWithoutShift: function(offset) {
    this._selectionDirection = 'right';
    this.selectionEnd = this.selectionEnd + offset;
    this.selectionStart = this.selectionEnd;
    return offset !== 0;
  },

  /**
   * private
   */
  swapSelectionPoints: function() {
    var swapSel = this.selectionEnd;
    this.selectionEnd = this.selectionStart;
    this.selectionStart = swapSel;
  },

  /**
   * Moves cursor down while keeping selection
   * @param {Number} offset
   */
  moveCursorDownWithShift: function(offset) {
    if (this.selectionEnd === this.selectionStart) {
      this._selectionDirection = 'right';
    }
    if (this._selectionDirection === 'right') {
      this.selectionEnd += offset;
    }
    else {
      this.selectionStart += offset;
    }
    if (this.selectionEnd < this.selectionStart  && this._selectionDirection === 'left') {
      this.swapSelectionPoints();
      this._selectionDirection = 'right';
    }
    if (this.selectionEnd > this.text.length) {
      this.selectionEnd = this.text.length;
    }
    return offset !== 0;
  },

  /**
   * @param {Event} e Event object
   * @param {Boolean} isRight
   * @return {Number}
   */
  getUpCursorOffset: function(e, isRight) {
    var selectionProp = isRight ? this.selectionEnd : this.selectionStart,
        cursorLocation = this.get2DCursorLocation(selectionProp),
        lineIndex = cursorLocation.lineIndex;
    // if on first line, up cursor goes to start of line
    if (lineIndex === 0 || e.metaKey || e.keyCode === 33) {
      return selectionProp;
    }

    var textOnSameLineBeforeCursor = this._textLines[lineIndex].slice(0, cursorLocation.charIndex),
        textOnPreviousLine = this._textLines[lineIndex - 1] || '',
        _char,
        widthOfSameLineBeforeCursor = this._getLineWidth(this.ctx, cursorLocation.lineIndex),
        lineLeftOffset = this._getLineLeftOffset(widthOfSameLineBeforeCursor),
        widthOfCharsOnSameLineBeforeCursor = lineLeftOffset;

    for (var i = 0, len = textOnSameLineBeforeCursor.length; i < len; i++) {
      _char = textOnSameLineBeforeCursor[i];
      widthOfCharsOnSameLineBeforeCursor += this._getWidthOfChar(this.ctx, _char, lineIndex, i);
    }

    var indexOnPrevLine = this._getIndexOnPrevLine(
      cursorLocation, textOnPreviousLine, widthOfCharsOnSameLineBeforeCursor);

    return textOnPreviousLine.length - indexOnPrevLine + textOnSameLineBeforeCursor.length;
  },

  /**
   * @private
   */
  _getIndexOnPrevLine: function(cursorLocation, textOnPreviousLine, widthOfCharsOnSameLineBeforeCursor) {

    var lineIndex = cursorLocation.lineIndex - 1,
        widthOfPreviousLine = this._getLineWidth(this.ctx, lineIndex),
        lineLeftOffset = this._getLineLeftOffset(widthOfPreviousLine),
        widthOfCharsOnPreviousLine = lineLeftOffset,
        indexOnPrevLine = 0,
        foundMatch;

    for (var j = 0, jlen = textOnPreviousLine.length; j < jlen; j++) {

      var _char = textOnPreviousLine[j],
          widthOfChar = this._getWidthOfChar(this.ctx, _char, lineIndex, j);

      widthOfCharsOnPreviousLine += widthOfChar;

      if (widthOfCharsOnPreviousLine > widthOfCharsOnSameLineBeforeCursor) {

        foundMatch = true;

        var leftEdge = widthOfCharsOnPreviousLine - widthOfChar,
            rightEdge = widthOfCharsOnPreviousLine,
            offsetFromLeftEdge = Math.abs(leftEdge - widthOfCharsOnSameLineBeforeCursor),
            offsetFromRightEdge = Math.abs(rightEdge - widthOfCharsOnSameLineBeforeCursor);

        indexOnPrevLine = offsetFromRightEdge < offsetFromLeftEdge ? j : (j - 1);

        break;
      }
    }

    // reached end
    if (!foundMatch) {
      indexOnPrevLine = textOnPreviousLine.length - 1;
    }

    return indexOnPrevLine;
  },

  /**
   * Moves cursor up
   * @param {Event} e Event object
   */
  moveCursorUp: function(e) {
    if (this.selectionStart === 0 && this.selectionEnd === 0) {
      return;
    }
    this._moveCursorUpOrDown('Up', e);
  },

  /**
   * Moves cursor up or down, fires the events
   * @param {String} direction 'Up' or 'Down'
   * @param {Event} e Event object
   */
  _moveCursorUpOrDown: function(direction, e) {
    var action = 'get' + direction + 'CursorOffset',
        moveAction = 'moveCursor' + direction,
        offset = this[action](e, this._selectionDirection === 'right');
    if (e.shiftKey) {
      moveAction += 'WithShift';
    }
    else {
      moveAction += 'WithoutShift';
    }
    if (this[moveAction](offset)) {
      this.abortCursorAnimation();
      this._currentCursorOpacity = 1;
      this.initDelayedCursor();
      this._fireSelectionChanged();
      this._updateTextarea();
    }
  },

  /**
   * Moves cursor up with shift
   * @param {Number} offset
   */
  moveCursorUpWithShift: function(offset) {
    if (this.selectionEnd === this.selectionStart) {
      this._selectionDirection = 'left';
    }
    if (this._selectionDirection === 'right') {
      this.selectionEnd -= offset;
    }
    else {
      this.selectionStart -= offset;
    }
    if (this.selectionEnd < this.selectionStart && this._selectionDirection === 'right') {
      this.swapSelectionPoints();
      this._selectionDirection = 'left';
    }
    return offset !== 0;
  },

  /**
   * Moves cursor up without shift
   * @param {Number} offset
   */
  moveCursorUpWithoutShift: function(offset) {
    this._selectionDirection = 'left';
    this.selectionStart -= offset;
    this.selectionEnd = this.selectionStart;
    return offset !== 0;
  },

  /**
   * Moves cursor left
   * @param {Event} e Event object
   */
  moveCursorLeft: function(e) {
    if (this.selectionStart === 0 && this.selectionEnd === 0) {
      return;
    }
    this._moveCursorLeftOrRight('Left', e);
  },

  /**
   * @private
   * @return {Boolean} true if a change happened
   */
  _move: function(e, prop, direction) {
    var newValue;
    if (e.altKey) {
      newValue = this['findWordBoundary' + direction](this[prop]);
    }
    else if (e.metaKey || e.keyCode === 35 ||  e.keyCode === 36 ) {
      newValue = this['findLineBoundary' + direction](this[prop]);
    }
    else {
      this[prop] += direction === 'Left' ? -1 : 1;
      return true;
    }
    if (typeof newValue !== undefined && this[prop] !== newValue) {
      this[prop] = newValue;
      return true;
    }
  },

  /**
   * @private
   */
  _moveLeft: function(e, prop) {
    return this._move(e, prop, 'Left');
  },

  /**
   * @private
   */
  _moveRight: function(e, prop) {
    return this._move(e, prop, 'Right');
  },

  /**
   * Moves cursor left without keeping selection
   * @param {Event} e
   */
  moveCursorLeftWithoutShift: function(e) {
    var change = true;
    this._selectionDirection = 'left';

    // only move cursor when there is no selection,
    // otherwise we discard it, and leave cursor on same place
    if (this.selectionEnd === this.selectionStart && this.selectionStart !== 0) {
      change = this._moveLeft(e, 'selectionStart');

    }
    this.selectionEnd = this.selectionStart;
    return change;
  },

  /**
   * Moves cursor left while keeping selection
   * @param {Event} e
   */
  moveCursorLeftWithShift: function(e) {
    if (this._selectionDirection === 'right' && this.selectionStart !== this.selectionEnd) {
      return this._moveLeft(e, 'selectionEnd');
    }
    else if (this.selectionStart !== 0){
      this._selectionDirection = 'left';
      return this._moveLeft(e, 'selectionStart');
    }
  },

  /**
   * Moves cursor right
   * @param {Event} e Event object
   */
  moveCursorRight: function(e) {
    if (this.selectionStart >= this.text.length && this.selectionEnd >= this.text.length) {
      return;
    }
    this._moveCursorLeftOrRight('Right', e);
  },

  /**
   * Moves cursor right or Left, fires event
   * @param {String} direction 'Left', 'Right'
   * @param {Event} e Event object
   */
  _moveCursorLeftOrRight: function(direction, e) {
    var actionName = 'moveCursor' + direction + 'With';
    this._currentCursorOpacity = 1;

    if (e.shiftKey) {
      actionName += 'Shift';
    }
    else {
      actionName += 'outShift';
    }
    if (this[actionName](e)) {
      this.abortCursorAnimation();
      this.initDelayedCursor();
      this._fireSelectionChanged();
      this._updateTextarea();
    }
  },

  /**
   * Moves cursor right while keeping selection
   * @param {Event} e
   */
  moveCursorRightWithShift: function(e) {
    if (this._selectionDirection === 'left' && this.selectionStart !== this.selectionEnd) {
      return this._moveRight(e, 'selectionStart');
    }
    else if (this.selectionEnd !== this.text.length) {
      this._selectionDirection = 'right';
      return this._moveRight(e, 'selectionEnd');
    }
  },

  /**
   * Moves cursor right without keeping selection
   * @param {Event} e Event object
   */
  moveCursorRightWithoutShift: function(e) {
    var changed = true;
    this._selectionDirection = 'right';

    if (this.selectionStart === this.selectionEnd) {
      changed = this._moveRight(e, 'selectionStart');
      this.selectionEnd = this.selectionStart;
    }
    else {
      this.selectionStart = this.selectionEnd;
    }
    return changed;
  },

  /**
   * Removes characters selected by selection
   * @param {Event} e Event object
   */
  removeChars: function(e) {
    if (this.selectionStart === this.selectionEnd) {
      this._removeCharsNearCursor(e);
    }
    else {
      this._removeCharsFromTo(this.selectionStart, this.selectionEnd);
    }

    this.setSelectionEnd(this.selectionStart);

    this._removeExtraneousStyles();

    this.canvas && this.canvas.renderAll();

    this.setCoords();
    this.fire('changed');
    this.canvas && this.canvas.fire('text:changed', { target: this });
  },

  /**
   * @private
   * @param {Event} e Event object
   */
  _removeCharsNearCursor: function(e) {
    if (this.selectionStart === 0) {
      return;
    }
    if (e.metaKey) {
      // remove all till the start of current line
      var leftLineBoundary = this.findLineBoundaryLeft(this.selectionStart);

      this._removeCharsFromTo(leftLineBoundary, this.selectionStart);
      this.setSelectionStart(leftLineBoundary);
    }
    else if (e.altKey) {
      // remove all till the start of current word
      var leftWordBoundary = this.findWordBoundaryLeft(this.selectionStart);

      this._removeCharsFromTo(leftWordBoundary, this.selectionStart);
      this.setSelectionStart(leftWordBoundary);
    }
    else {
      this._removeSingleCharAndStyle(this.selectionStart);
      this.setSelectionStart(this.selectionStart - 1);
    }
  }
});
