[Setup]
AppId=CSPHelperOffline
AppName=CSP 备考助手（离线版）
AppVersion=1.0
DefaultDirName={localappdata}\Programs\CSP-helper
PrivilegesRequired=lowest
OutputBaseFilename=CSP-helper-Windows-v1.0-Setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=CSP 备考助手（离线版）
[Files]
Source: "{#Stage}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
[Icons]
Name: "{userprograms}\CSP 备考助手（离线版）"; Filename: "{app}\CSP-helper.exe"
Name: "{userdesktop}\CSP 备考助手（离线版）"; Filename: "{app}\CSP-helper.exe"
[Run]
Filename: "{app}\CSP-helper.exe"; Description: "打开 CSP 备考助手"; Flags: nowait postinstall skipifsilent
