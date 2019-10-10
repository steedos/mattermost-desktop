
Dim oWord, oDocument, oExcel, oWorkbook, oPPT, oPresentation, FileClosed
FileClosed = False

Dim filename, baseName, username

Const wdFormatPDF = 17

filename = Wscript.Arguments.Item(0)
username = Wscript.Arguments.Item(1)

If username = "Steedos.User.isDocToPdf" Then
	DocToPdf (filename)
Else
	Edit(filename)
End If

Sub Edit(filename)

	' Create a File System object
	Set objFSO = CreateObject( "Scripting.FileSystemObject" )

	' Check if the Word document exists
	If objFSO.FileExists( filename ) Then
		Set objFile = objFSO.GetFile( filename )
		strFile = objFile.Path
	Else
		WScript.Echo "The file does not exist" & vbCrLf
		' Close Word
		WScript.Quit(404)
		Exit Sub
	End If

	' 获取文件后缀名 
	strExt = objFSO.GetExtensionName(strFile)
	' 获取文件名
	baseName = objFSO.GetBaseName(strFile)

	If strExt = "docx" or strExt = "doc" then
		EditDocument(strFile)
	' --------To Do-------------
	' ElseIf strExt = "xlsx" or strExt = "xls" then
	'     EditWorkbook(strFile)
	' ElseIf strExt = "pptx" or strExt = "ppt" then
	'     EditPresentation(strFile)
	' ---------------------------
	Else
		FileClosed = True
	End If

End Sub  

Sub DocToPdf(docInputFile)

	Dim fileSystemObject, wordApplication, wordDocument, wordDocuments, baseFolder, pdfOutputFile
	
	Set fileSystemObject = CreateObject("Scripting.FileSystemObject")
	Set wordApplication = CreateObject("Word.Application")
	Set wordDocuments = wordApplication.Documents
	
	docInputFile = fileSystemObject.GetAbsolutePathName(docInputFile)
	baseFolder = fileSystemObject.GetParentFolderName(docInputFile)

	pdfOutputFile = fileSystemObject.GetBaseName(docInputFile) + ".pdf"
	
	pdfOutputFile = baseFolder + "\" + pdfOutputFile

	' Disable any potential macros of the word document.
	wordApplication.WordBasic.DisableAutoMacros

	Set wordDocument = wordDocuments.Open(docInputFile)
	
	' See http://msdn2.microsoft.com/en-us/library/bb221597.aspx
	wordDocument.SaveAs pdfOutputFile, wdFormatPDF

	wordDocument.Close WdDoNotSaveChanges
	wordApplication.Quit WdDoNotSaveChanges
	FileClosed = True
	
	Set wordApplication = Nothing
	Set fileSystemObject = Nothing

End Sub

Sub EditDocument( strFile )

	' Create a Word object
	Set oWord = WScript.CreateObject( "Word.Application", "oWord_" )
	
	Set oWordT = oWord.Tasks
	
	Set ws = WScript.CreateObject("WScript.Shell")

	With oWord
		' True: make Word visible; False: invisible
		.Visible = true
		
		' Open the Word document
		.Documents.Open strFile
		
		If oWordT.Exists(.ActiveWindow.Caption) Then
			ws.AppActivate .ActiveWindow.Caption
		End If
		
		' 查看时不显示修订痕迹
		If username = "Steedos.User.isView" Then
		
			.ActiveDocument.ShowRevisions = false

		Else
			.ActiveDocument.Application.UserName = username

			.ActiveDocument.TrackRevisions = true
		
		End If
		
		' Make the opened file the active document
		' MsgBox oWord.ActiveWindow.Caption
		
		Set oDocument = .ActiveDocument
		WScript.ConnectObject oDocument, "oDocument_"
		
	End With

End Sub


Sub oDocument_Close()
	oDocument.Save()
	FileClosed = True
End Sub


' Sub EditWorkbook( strFile )
	
'     WScript.Echo baseName & vbCrLf

'     Set oExcel = WScript.CreateObject( "Excel.Application", "oExcel_")

'     With oExcel
	

'         .Workbooks.Open strFile

'         WScript.Echo "11111"
		
'         .Visible = True

'         Set oWorkbook = .ActiveWorkbook
'         WScript.ConnectObject oWorkbook, "oWorkbook_"

'     End With

' End Sub

' Sub oWorkbook_Close()
'     oWorkbook.Save()
'     FileClosed = True
' End Sub

' Sub EditPresentation( strFile )

'     ' FileClosed = False
'     ' Create a ppt object
'     Set oPPT = WScript.CreateObject( "PowerPoint.Application", "oPPT_" )

'     With oPPT
'         ' True: make ppt visible; False: invisible
'         .Visible = True

'         ' Open the ppt document
'         .Presentations.Open strFile

'         ' Make the opened file the active document
'         Set oPresentation = .ActivePresentation
'         WScript.ConnectObject oPresentation, "oPresentation_"

'     End With

' End Sub

' Sub oPresentation_Close()
'     oPresentation.Save()
'     FileClosed = True
' End Sub

Do Until FileClosed
	WScript.sleep 1000
Loop