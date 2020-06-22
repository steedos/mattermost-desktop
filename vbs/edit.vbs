
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
'' SIG '' Begin signature block
'' SIG '' MIIPSwYJKoZIhvcNAQcCoIIPPDCCDzgCAQExCzAJBgUr
'' SIG '' DgMCGgUAMGcGCisGAQQBgjcCAQSgWTBXMDIGCisGAQQB
'' SIG '' gjcCAR4wJAIBAQQQTvApFpkntU2P5azhDxfrqwIBAAIB
'' SIG '' AAIBAAIBAAIBADAhMAkGBSsOAwIaBQAEFN90QlCiq2nW
'' SIG '' +9CgQhobpPyb1NDLoIIMnTCCBdkwggTBoAMCAQICEAMt
'' SIG '' y2T6swlFxlMJsoKnpHcwDQYJKoZIhvcNAQELBQAwbDEL
'' SIG '' MAkGA1UEBhMCVVMxFTATBgNVBAoTDERpZ2lDZXJ0IElu
'' SIG '' YzEZMBcGA1UECxMQd3d3LmRpZ2ljZXJ0LmNvbTErMCkG
'' SIG '' A1UEAxMiRGlnaUNlcnQgRVYgQ29kZSBTaWduaW5nIENB
'' SIG '' IChTSEEyKTAeFw0xOTA1MTMwMDAwMDBaFw0yMDA1MjAx
'' SIG '' MjAwMDBaMIHmMRMwEQYLKwYBBAGCNzwCAQMTAkNOMRcw
'' SIG '' FQYLKwYBBAGCNzwCAQIMBuS4iua1tzEdMBsGA1UEDwwU
'' SIG '' UHJpdmF0ZSBPcmdhbml6YXRpb24xGzAZBgNVBAUTEjkx
'' SIG '' MzEwMTEyNzAzMjU1MDQyUjELMAkGA1UEBhMCQ04xDzAN
'' SIG '' BgNVBAcMBuS4iua1tzEtMCsGA1UECgwk5LiK5rW35Y2O
'' SIG '' 54KO6L2v5Lu256eR5oqA5pyJ6ZmQ5YWs5Y+4MS0wKwYD
'' SIG '' VQQDDCTkuIrmtbfljY7ngo7ova/ku7bnp5HmioDmnInp
'' SIG '' mZDlhazlj7gwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
'' SIG '' ggEKAoIBAQC13sG4aGxPXOAPLsz+/yxamnrxWn2/8rd8
'' SIG '' pqXPTyhv3wWQ4ZDgN3PdPMmT62usrHgW1YkkqkyK3f7g
'' SIG '' GY7h/oOFQ2jaeS2V9Himerxzybakbtxc+JWE4ohuHb6o
'' SIG '' c1czogvT6iIDDWDTWBl2zw0pnY+hX0CsY0sTnIPUaWOm
'' SIG '' x2LoEchPs6Yt5t31UQhUFI5Mnaz/dFgbHwCdGoeonItM
'' SIG '' OerVgvRbCtiHOdBlN+o0wv1FJwfeV1UMAnreX+X47je2
'' SIG '' nuHNpErMdHHVhZ5paG/JEd1v5t1JkWvVL6nEFB3oB3I9
'' SIG '' cWKv7PD6mqfX+l92KOikuObQIchzaF6dHZDZgzMOJSoV
'' SIG '' AgMBAAGjggH6MIIB9jAfBgNVHSMEGDAWgBSP6H7wbTJq
'' SIG '' AAUjx3CXajqQ/2vq1DAdBgNVHQ4EFgQUtGvPIgZrvXcs
'' SIG '' jjTdcBxVFR82zvswNwYDVR0RBDAwLqAsBggrBgEFBQcI
'' SIG '' A6AgMB4MHENOLeS4iua1ty05MTMxMDExMjcwMzI1NTA0
'' SIG '' MlIwDgYDVR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoGCCsG
'' SIG '' AQUFBwMDMHsGA1UdHwR0MHIwN6A1oDOGMWh0dHA6Ly9j
'' SIG '' cmwzLmRpZ2ljZXJ0LmNvbS9FVkNvZGVTaWduaW5nU0hB
'' SIG '' Mi1nMS5jcmwwN6A1oDOGMWh0dHA6Ly9jcmw0LmRpZ2lj
'' SIG '' ZXJ0LmNvbS9FVkNvZGVTaWduaW5nU0hBMi1nMS5jcmww
'' SIG '' SwYDVR0gBEQwQjA3BglghkgBhv1sAwIwKjAoBggrBgEF
'' SIG '' BQcCARYcaHR0cHM6Ly93d3cuZGlnaWNlcnQuY29tL0NQ
'' SIG '' UzAHBgVngQwBAzB+BggrBgEFBQcBAQRyMHAwJAYIKwYB
'' SIG '' BQUHMAGGGGh0dHA6Ly9vY3NwLmRpZ2ljZXJ0LmNvbTBI
'' SIG '' BggrBgEFBQcwAoY8aHR0cDovL2NhY2VydHMuZGlnaWNl
'' SIG '' cnQuY29tL0RpZ2lDZXJ0RVZDb2RlU2lnbmluZ0NBLVNI
'' SIG '' QTIuY3J0MAwGA1UdEwEB/wQCMAAwDQYJKoZIhvcNAQEL
'' SIG '' BQADggEBAGDmzl53yiiWQmetCCs5Qe3XUjEbQw2uUGsi
'' SIG '' tvTGbBJO3XZTjXoBeNStijWOe0Pet3q4CnsVOGhenqq5
'' SIG '' GG+GKtZ7J7oBnfX+aoIOZYxKItVNWLbcyQZKLG88yL2i
'' SIG '' 5/QzJMUG/Bx+SIPwb9O0UI510lrnSD1oovXVkFoiqknd
'' SIG '' m1eU86HNfYQ7DNhyknL5hew4R+m9zCF0h04Cjqifc4W+
'' SIG '' 48NcKIi9n8t48rUpW3UtdPq5cQZ4DJox5EZ4mGx42xp0
'' SIG '' pUHMSy2ZbKRTpW3U5w2XgJFBdT51TKzc23sb5OwPR+gG
'' SIG '' zUXiCrVR/P6wRGMMqpqN472s97mxR3oFcgmVW2T63cww
'' SIG '' gga8MIIFpKADAgECAhAD8bThXzqC8RSWeLPX2EdcMA0G
'' SIG '' CSqGSIb3DQEBCwUAMGwxCzAJBgNVBAYTAlVTMRUwEwYD
'' SIG '' VQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5k
'' SIG '' aWdpY2VydC5jb20xKzApBgNVBAMTIkRpZ2lDZXJ0IEhp
'' SIG '' Z2ggQXNzdXJhbmNlIEVWIFJvb3QgQ0EwHhcNMTIwNDE4
'' SIG '' MTIwMDAwWhcNMjcwNDE4MTIwMDAwWjBsMQswCQYDVQQG
'' SIG '' EwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYD
'' SIG '' VQQLExB3d3cuZGlnaWNlcnQuY29tMSswKQYDVQQDEyJE
'' SIG '' aWdpQ2VydCBFViBDb2RlIFNpZ25pbmcgQ0EgKFNIQTIp
'' SIG '' MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
'' SIG '' p1P6D7K1E/Fkz4SA/K6ANdG218ejLKwaLKzxhKw6NRI6
'' SIG '' kpG6V+TEyfMvqEg8t9Zu3JciulF5Ya9DLw23m7RJMa5E
'' SIG '' WD6koZanh08jfsNsZSSQVT6hyiN8xULpxHpiRZt93mN0
'' SIG '' y55jJfiEmpqtRU+ufR/IE8t1m8nh4Yr4CwyY9Mo+0EWq
'' SIG '' eh6lWJM2NL4rLisxWGa0MhCfnfBSoe/oPtN28kBa3Ppq
'' SIG '' PRtLrXawjFzuNrqD6jCoTN7xCypYQYiuAImrA9EWgiAi
'' SIG '' duteVDgSYuHScCTb7R9w0mQJgC3itp3OH/K7IfNs29iz
'' SIG '' GXuKUJ/v7DYKXJq3StMIoDl5/d2/PToJJQIDAQABo4ID
'' SIG '' WDCCA1QwEgYDVR0TAQH/BAgwBgEB/wIBADAOBgNVHQ8B
'' SIG '' Af8EBAMCAYYwEwYDVR0lBAwwCgYIKwYBBQUHAwMwfwYI
'' SIG '' KwYBBQUHAQEEczBxMCQGCCsGAQUFBzABhhhodHRwOi8v
'' SIG '' b2NzcC5kaWdpY2VydC5jb20wSQYIKwYBBQUHMAKGPWh0
'' SIG '' dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2Vy
'' SIG '' dEhpZ2hBc3N1cmFuY2VFVlJvb3RDQS5jcnQwgY8GA1Ud
'' SIG '' HwSBhzCBhDBAoD6gPIY6aHR0cDovL2NybDMuZGlnaWNl
'' SIG '' cnQuY29tL0RpZ2lDZXJ0SGlnaEFzc3VyYW5jZUVWUm9v
'' SIG '' dENBLmNybDBAoD6gPIY6aHR0cDovL2NybDQuZGlnaWNl
'' SIG '' cnQuY29tL0RpZ2lDZXJ0SGlnaEFzc3VyYW5jZUVWUm9v
'' SIG '' dENBLmNybDCCAcQGA1UdIASCAbswggG3MIIBswYJYIZI
'' SIG '' AYb9bAMCMIIBpDA6BggrBgEFBQcCARYuaHR0cDovL3d3
'' SIG '' dy5kaWdpY2VydC5jb20vc3NsLWNwcy1yZXBvc2l0b3J5
'' SIG '' Lmh0bTCCAWQGCCsGAQUFBwICMIIBVh6CAVIAQQBuAHkA
'' SIG '' IAB1AHMAZQAgAG8AZgAgAHQAaABpAHMAIABDAGUAcgB0
'' SIG '' AGkAZgBpAGMAYQB0AGUAIABjAG8AbgBzAHQAaQB0AHUA
'' SIG '' dABlAHMAIABhAGMAYwBlAHAAdABhAG4AYwBlACAAbwBm
'' SIG '' ACAAdABoAGUAIABEAGkAZwBpAEMAZQByAHQAIABDAFAA
'' SIG '' LwBDAFAAUwAgAGEAbgBkACAAdABoAGUAIABSAGUAbAB5
'' SIG '' AGkAbgBnACAAUABhAHIAdAB5ACAAQQBnAHIAZQBlAG0A
'' SIG '' ZQBuAHQAIAB3AGgAaQBjAGgAIABsAGkAbQBpAHQAIABs
'' SIG '' AGkAYQBiAGkAbABpAHQAeQAgAGEAbgBkACAAYQByAGUA
'' SIG '' IABpAG4AYwBvAHIAcABvAHIAYQB0AGUAZAAgAGgAZQBy
'' SIG '' AGUAaQBuACAAYgB5ACAAcgBlAGYAZQByAGUAbgBjAGUA
'' SIG '' LjAdBgNVHQ4EFgQUj+h+8G0yagAFI8dwl2o6kP9r6tQw
'' SIG '' HwYDVR0jBBgwFoAUsT7DaQP4v0cB1JgmGggC72NkK8Mw
'' SIG '' DQYJKoZIhvcNAQELBQADggEBABkzSgyBMzfbrTbJ5Mk6
'' SIG '' u7UbLnqi4vRDQheev06hTeGx2+mB3Z8B8uSI1en+Cf0h
'' SIG '' wexdgNLw1sFDwv53K9v515EzzmzVshk75i7WyZNPiECO
'' SIG '' zeH1fvEPxllWcujrakG9HNVG1XxJymY4FcG/4JFwd4fc
'' SIG '' yY0xyQwpojPtjeKHzYmNPxv/1eAal4t82m37qMayOmZr
'' SIG '' ewGzzdimNOwSAauVWKXEU1eoYObnAhKguSNkok27fIEl
'' SIG '' ZCG+z+5CGEOXu6U3Bq9N/yalTWFL7EZBuGXOuHmeCJYL
'' SIG '' gYyKO4/HmYyjKm6YbV5hxpa3irlhLZO46w4EQ9f1/qbw
'' SIG '' YtSZaqXBwfBklIAxggIaMIICFgIBATCBgDBsMQswCQYD
'' SIG '' VQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkw
'' SIG '' FwYDVQQLExB3d3cuZGlnaWNlcnQuY29tMSswKQYDVQQD
'' SIG '' EyJEaWdpQ2VydCBFViBDb2RlIFNpZ25pbmcgQ0EgKFNI
'' SIG '' QTIpAhADLctk+rMJRcZTCbKCp6R3MAkGBSsOAwIaBQCg
'' SIG '' cDAQBgorBgEEAYI3AgEMMQIwADAZBgkqhkiG9w0BCQMx
'' SIG '' DAYKKwYBBAGCNwIBBDAcBgorBgEEAYI3AgELMQ4wDAYK
'' SIG '' KwYBBAGCNwIBFTAjBgkqhkiG9w0BCQQxFgQUA2bkd1WM
'' SIG '' jvB8jcnNUFQwYndiKOMwDQYJKoZIhvcNAQEBBQAEggEA
'' SIG '' jbmlxejdBUPx58vD8QQHcSQGRqG6YmR20JskDOqdLaLt
'' SIG '' mC5t4nHwK6PRdMZdmVp/FX83606jWJW8QAVdeEKBk/8s
'' SIG '' nJEKtXIZB6w7efshr1jHPWv/7EX4hnpfz2B0k/QM/QuZ
'' SIG '' 5YOMxFaUDQ4kWvyjUDA4sRkmcl5T1dDmq4X8XqT0OtwL
'' SIG '' fAWWnuJrZHey2WCFkRnik8C9iELBf6YC8ycNI1VL9N6m
'' SIG '' FRlqi6+b7YFrx1gGXxjpgsLmG88Qfd9OuOdnQ2htaq5n
'' SIG '' eDmblAt01J8N43UdqxJKexZlVUS0BXIyeScJKk8CZukB
'' SIG '' j6DdnHZ4cw0UInLNH5R8caHzWrvxt//CzQ==
'' SIG '' End signature block
