Set objShell = CreateObject("WScript.Shell")
carpeta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = carpeta
objShell.Run """" & carpeta & "\iniciar-servidor.bat""", 0, False
