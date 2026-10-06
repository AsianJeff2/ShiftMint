' ShiftMint Silent Launcher (No Console Window)
' Matrix-optimized: Simple + Least Invasive
' Launches ShiftMint without any visible console

Dim WshShell, objFSO, strPath
Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current directory
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Check if production build exists
If objFSO.FileExists(strPath & "\dist\win-unpacked\ShiftMint.exe") Then
    ' Launch production build silently
    WshShell.Run """" & strPath & "\dist\win-unpacked\ShiftMint.exe""", 0, False
ElseIf objFSO.FileExists(strPath & "\dist-installer\win-unpacked\ShiftMint.exe") Then
    ' Launch from dist-installer
    WshShell.Run """" & strPath & "\dist-installer\win-unpacked\ShiftMint.exe""", 0, False
Else
    ' Development mode - run npm silently
    WshShell.CurrentDirectory = strPath
    WshShell.Run "cmd /c npm run dev", 0, False
    
    ' Show a message that it's starting
    MsgBox "ShiftMint is starting in development mode. Please wait a moment for the window to appear.", 64, "ShiftMint"
End If