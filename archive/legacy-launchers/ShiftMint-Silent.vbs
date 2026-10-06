' ShiftMint Desktop Launcher (No Console)
' This script launches ShiftMint without showing a console window

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the current directory
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Build paths to possible executables
exe64Path = currentDir & "\dist\win-unpacked\ShiftMint.exe"
exe32Path = currentDir & "\dist\win-ia32-unpacked\ShiftMint.exe"

' Check for 64-bit executable first
If fso.FileExists(exe64Path) Then
    WshShell.Run """" & exe64Path & """", 0, False
' Check for 32-bit executable
ElseIf fso.FileExists(exe32Path) Then
    WshShell.Run """" & exe32Path & """", 0, False
Else
    ' Show error if no executable found
    MsgBox "ShiftMint executable not found!" & vbCrLf & vbCrLf & _
           "Please build the application first:" & vbCrLf & _
           "  npm run dist:win" & vbCrLf & vbCrLf & _
           "Searched locations:" & vbCrLf & _
           exe64Path & vbCrLf & _
           exe32Path, vbExclamation, "ShiftMint - Error"
End If
