' ShiftMint Desktop Launcher (No Console)
' This script launches ShiftMint without showing a console window

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the current directory
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Build the path to the executable
exePath = currentDir & "\dist\win-unpacked\ShiftMint.exe"

' Check if the executable exists
If fso.FileExists(exePath) Then
    ' Launch the application silently
    WshShell.Run """" & exePath & """", 0, False
    
    ' Optional: Show a brief notification that it's starting
    ' MsgBox "ShiftMint is starting...", vbInformation, "ShiftMint", 1
Else
    ' Show error if executable not found
    MsgBox "ShiftMint executable not found!" & vbCrLf & vbCrLf & _
           "Please build the application first:" & vbCrLf & _
           "  npm run dist:win" & vbCrLf & vbCrLf & _
           "Expected location:" & vbCrLf & _
           exePath, vbExclamation, "ShiftMint - Error"
End If