; Lorekeeper quick notes for Windows (AutoHotkey v2). UNTESTED. Needs Git for Windows, for sh.exe.
; Set VAULT to your vault's folder, then run this file (put a shortcut to it in shell:startup to start it at login).
#Requires AutoHotkey v2.0
VAULT := A_MyDocuments "\Lorekeeper"
SH := "C:\Program Files\Git\bin\sh.exe"

^!n:: {  ; Ctrl+Alt+N: the note box
    box := InputBox("Note", "Lorekeeper")
    if (box.Result = "OK" && Trim(box.Value) != "")
        Save(box.Value)
}

^+s:: {  ; Ctrl+Shift+S: save the selected text, or the clipboard if nothing is selected
    saved := ClipboardAll()
    A_Clipboard := ""
    Send "^c"
    text := ClipWait(0.5) ? A_Clipboard : ""
    A_Clipboard := saved
    if (Trim(text) = "")
        text := A_Clipboard
    if (Trim(text) != "")
        Save(text)
}

Save(text, flag := "") {
    tmp := A_Temp "\lorekeeper-note.txt"
    try FileDelete(tmp)
    FileAppend(text, tmp, "UTF-8-RAW")
    script := VAULT "\_lorekeeper\capture\lk-note"
    cmd := Format('"{1}" -c "exec sh \"$0\" --vault \"$1\" {2} --stdin < \"$2\"" "{3}" "{4}" "{5}"', SH, flag, script, VAULT, tmp)
    code := RunWait(cmd, , "Hide")
    if (code = 3) {
        answer := MsgBox("This session went quiet over 12 hours ago. Start the next session?", "Lorekeeper", "YesNo")
        Save(text, answer = "Yes" ? "--next" : "--here")
    } else if (code != 0) {
        MsgBox("Lorekeeper couldn't save the note (code " code "). Check VAULT and SH at the top of lorekeeper.ahk.", "Lorekeeper")
    }
}
