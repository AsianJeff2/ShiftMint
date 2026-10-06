' ShiftMint Visible Window Launcher
' Matrix-optimized: Integrative solution ensuring window visibility

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current directory
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Kill any existing processes
WshShell.Run "taskkill /F /IM electron.exe", 0, True
WshShell.Run "taskkill /F /IM ShiftMint.exe", 0, True

' Wait a moment
WScript.Sleep 1000

' Check for production build
If objFSO.FileExists(strPath & "\dist\win-unpacked\ShiftMint.exe") Then
    ' Launch production build
    WshShell.Run """" & strPath & "\dist\win-unpacked\ShiftMint.exe""", 1, False
ElseIf objFSO.FileExists(strPath & "\dist-installer\win-unpacked\ShiftMint.exe") Then
    ' Launch from installer directory
    WshShell.Run """" & strPath & "\dist-installer\win-unpacked\ShiftMint.exe""", 1, False
Else
    ' Development mode - run with visible window
    WshShell.CurrentDirectory = strPath
    
    ' Launch in a new PowerShell window to ensure visibility
    WshShell.Run "powershell -WindowStyle Normal -Command ""npm run dev""", 1, False
    
    ' Wait and bring window to front
    WScript.Sleep 5000
    WshShell.AppActivate "ShiftMint"
End If

' Ensure window is activated after launch
WScript.Sleep 3000
WshShell.AppActivate "ShiftMint"
WshShell.SendKeys "%{TAB}"  ' Alt+Tab to bring to front