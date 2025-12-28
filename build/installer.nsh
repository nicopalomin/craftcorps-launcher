!macro customInstall
  DetailPrint "Cleaning previous installation..."
  
  ; Check if we are installing into a directory that exists
  IfFileExists "$INSTDIR\resources\app.asar" 0 +2
    DetailPrint "Found existing installation, cleaning up..."

  ; Remove main directories
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\swiftshader"
  
  ; Remove root files (excluding uninstaller if it exists, though installer overwrites it later)
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\version"
  
  ; Remove the main executable
  Delete "$INSTDIR\${productName}.exe"
  
  DetailPrint "Cleanup complete."
!macroend
