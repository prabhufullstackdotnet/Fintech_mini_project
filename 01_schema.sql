CREATE DATABASE FintechStageDB
GO

USE FintechStageDB
GO

CREATE TABLE tbl_Accounts (
 acc_AccountId INT IDENTITY(1,1) CONSTRAINT PK_tbl_Accounts PRIMARY KEY,
 acc_AccountCode VARCHAR(20) NOT NULL,
 acc_AccountName VARCHAR(150) NOT NULL,
 acc_AccountType VARCHAR(20) NOT NULL,
 acc_IsActive BIT NOT NULL CONSTRAINT DF_tbl_Accounts_IsActive DEFAULT (1),
 acc_CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_tbl_Accounts_CreatedAt DEFAULT (SYSUTCDATETIME()),
 CONSTRAINT UQ_tbl_Accounts_AccountCode UNIQUE (acc_AccountCode),
 CONSTRAINT CK_tbl_Accounts_AccountType CHECK (acc_AccountType IN ('Asset','Liability','Equity','Revenue','Expense')),
 CONSTRAINT CK_tbl_Accounts_Code_NotBlank CHECK (LEN(LTRIM(RTRIM(acc_AccountCode))) > 0),
 CONSTRAINT CK_tbl_Accounts_Name_NotBlank CHECK (LEN(LTRIM(RTRIM(acc_AccountName))) > 0)
);

CREATE TABLE tbl_JournalEntryHeaders (
 jeh_JournalEntryId BIGINT IDENTITY(1,1) CONSTRAINT PK_tbl_JournalEntryHeaders PRIMARY KEY,
 jeh_EntryNumber VARCHAR(30) NOT NULL,
 jeh_EntryDate DATE NOT NULL,
 jeh_Description VARCHAR(500) NOT NULL,
 jeh_CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_tbl_JournalEntryHeaders_CreatedAt DEFAULT (SYSUTCDATETIME()),
 jeh_CreatedBy VARCHAR(100) NULL,
 CONSTRAINT UQ_tbl_JournalEntryHeaders_EntryNumber UNIQUE (jeh_EntryNumber),
 CONSTRAINT CK_tbl_JournalEntryHeaders_Number_NotBlank CHECK (LEN(LTRIM(RTRIM(jeh_EntryNumber))) > 0),
 CONSTRAINT CK_tbl_JournalEntryHeaders_Description_NotBlank CHECK (LEN(LTRIM(RTRIM(jeh_Description))) > 0)
)
CREATE INDEX IX_tbl_JournalEntryHeaders_EntryDate ON tbl_JournalEntryHeaders(jeh_EntryDate DESC, jeh_JournalEntryId DESC)
CREATE TABLE  tbl_JournalEntryLines (
 jel_JournalEntryLineId BIGINT IDENTITY(1,1) CONSTRAINT PK_tbl_JournalEntryLines PRIMARY KEY,
 jel_JournalEntryId BIGINT NOT NULL,
 jel_AccountId INT NOT NULL,
 jel_Debit DECIMAL(19,4) NOT NULL CONSTRAINT DF_tbl_JournalEntryLines_Debit DEFAULT (0),
 jel_Credit DECIMAL(19,4) NOT NULL CONSTRAINT DF_tbl_JournalEntryLines_Credit DEFAULT (0),
 jel_LineDescription VARCHAR(250) NULL,
 CONSTRAINT FK_tbl_JournalEntryLines_Header FOREIGN KEY (jel_JournalEntryId) REFERENCES  tbl_JournalEntryHeaders(jeh_JournalEntryId),
 CONSTRAINT FK_tbl_JournalEntryLines_Account FOREIGN KEY (jel_AccountId) REFERENCES  tbl_Accounts(acc_AccountId),
 CONSTRAINT CK_tbl_JournalEntryLines_OneSideOnly CHECK ((jel_Debit > 0 AND jel_Credit = 0) OR (jel_Credit > 0 AND jel_Debit = 0))
)

CREATE INDEX IX_tbl_JournalEntryLines_JournalEntryId ON  tbl_JournalEntryLines(jel_JournalEntryId)
CREATE INDEX IX_tbl_JournalEntryLines_AccountId ON  tbl_JournalEntryLines(jel_AccountId)

CREATE TABLE tbl_AuditLogs (
 aud_AuditLogId BIGINT IDENTITY(1,1) CONSTRAINT PK_tbl_AuditLogs PRIMARY KEY,
 aud_EntityName VARCHAR(100) NOT NULL,
 aud_EntityId VARCHAR(100) NOT NULL,
 aud_Action VARCHAR(50) NOT NULL,
 aud_Details NVARCHAR(MAX) NULL,
 aud_CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_tbl_AuditLogs_CreatedAt DEFAULT (SYSUTCDATETIME()),
 aud_CreatedBy VARCHAR(100) NULL
)

CREATE INDEX IX_tbl_AuditLogs_Entity ON tbl_AuditLogs(aud_EntityName, aud_EntityId, aud_CreatedAt DESC)

GO
CREATE PROC sp_GetAccounts
@IncludeInactive BIT = 0 AS
BEGIN

 SELECT acc_AccountId,acc_AccountCode,acc_AccountName,acc_AccountType,acc_IsActive,acc_CreatedAt
 FROM tbl_Accounts WHERE (@IncludeInactive=1 OR acc_IsActive=1) ORDER BY acc_AccountCode;
END
GO
-------------------------------------------------------------------------------------------------------------
CREATE PROC sp_CreateJournalEntry
 @EntryNumber VARCHAR(30),
 @EntryDate DATE,
 @Description VARCHAR(500),
 @CreatedBy VARCHAR(100)=NULL,
 @LinesJson NVARCHAR(MAX)
AS
BEGIN
 BEGIN TRY
  IF NULLIF(LTRIM(RTRIM(@EntryNumber)),'') IS NULL THROW 51001,'Entry number is required.',1;
  IF LEN(@EntryNumber)>30 THROW 51002,'Entry number cannot exceed 30 characters.',1;
  IF @EntryDate IS NULL THROW 51003,'Entry date is required.',1;
  IF NULLIF(LTRIM(RTRIM(@Description)),'') IS NULL THROW 51004,'Description is required.',1;
  IF LEN(@Description)>500 THROW 51005,'Description cannot exceed 500 characters.',1;
  IF @CreatedBy IS NOT NULL AND LEN(@CreatedBy)>100 THROW 51006,'CreatedBy cannot exceed 100 characters.',1;
  IF ISNULL(ISJSON(@LinesJson),0)<>1 OR LEFT(LTRIM(@LinesJson),1)<>'[' THROW 51007,'Lines must be a valid JSON array.',1;

  DECLARE @Lines TABLE(AccountId INT NULL, Debit DECIMAL(19,4) NULL, Credit DECIMAL(19,4) NULL, LineDescription VARCHAR(250) NULL);
  INSERT @Lines(AccountId,Debit,Credit,LineDescription)
  SELECT AccountId,Debit,Credit,LineDescription FROM OPENJSON(@LinesJson)
  WITH(AccountId INT '$.AccountId', Debit DECIMAL(19,4) '$.Debit', Credit DECIMAL(19,4) '$.Credit', LineDescription VARCHAR(250) '$.LineDescription');
  IF (SELECT COUNT(*) FROM @Lines)<2 THROW 51008,'At least two journal entry lines are required.',1;
  IF EXISTS(SELECT 1 FROM @Lines WHERE AccountId IS NULL OR AccountId<=0 OR Debit IS NULL OR Credit IS NULL OR Debit<0 OR Credit<0 OR (Debit=0 AND Credit=0) OR (Debit>0 AND Credit>0))
   THROW 51009,'Each line needs an account and exactly one positive debit or credit amount.',1;
  IF EXISTS(SELECT 1 FROM @Lines WHERE LineDescription IS NOT NULL AND LEN(LineDescription)>250) THROW 51010,'Line description cannot exceed 250 characters.',1;

  BEGIN TRANSACTION;
  /* Lock referenced account rows during status validation and insert. */
  IF EXISTS(SELECT 1 FROM @Lines l LEFT JOIN tbl_Accounts a WITH (UPDLOCK,HOLDLOCK) ON a.acc_AccountId=l.AccountId WHERE a.acc_AccountId IS NULL)
   THROW 51011,'One or more account IDs do not exist.',1;
  IF EXISTS(SELECT 1 FROM @Lines l JOIN tbl_Accounts a WITH (UPDLOCK,HOLDLOCK) ON a.acc_AccountId=l.AccountId WHERE a.acc_IsActive=0)
   THROW 51012,'Inactive accounts cannot be used.',1;
  IF (SELECT SUM(Debit) FROM @Lines)<>(SELECT SUM(Credit) FROM @Lines) THROW 51013,'Total debit must equal total credit.',1;
  IF EXISTS(SELECT 1 FROM tbl_JournalEntryHeaders WITH (UPDLOCK,HOLDLOCK) WHERE jeh_EntryNumber=@EntryNumber)
   THROW 51014,'Entry number already exists.',1;

  INSERT tbl_JournalEntryHeaders(jeh_EntryNumber,jeh_EntryDate,jeh_Description,jeh_CreatedBy)
  VALUES(@EntryNumber,@EntryDate,@Description,@CreatedBy);
  DECLARE @Id BIGINT=CONVERT(BIGINT,SCOPE_IDENTITY());
  INSERT  tbl_JournalEntryLines(jel_JournalEntryId,jel_AccountId,jel_Debit,jel_Credit,jel_LineDescription)
  SELECT @Id,AccountId,Debit,Credit,LineDescription FROM @Lines;
  INSERT  tbl_AuditLogs(aud_EntityName,aud_EntityId,aud_Action,aud_Details,aud_CreatedBy)
  VALUES('JournalEntry',CONVERT(VARCHAR(100),@Id),'CREATE',CONCAT('Entry ',@EntryNumber,' created. Debit=',CONVERT(VARCHAR(50),(SELECT SUM(Debit) FROM @Lines)),'; Credit=',CONVERT(VARCHAR(50),(SELECT SUM(Credit) FROM @Lines))),@CreatedBy);
  COMMIT TRANSACTION;
  SELECT @Id AS JournalEntryId,@EntryNumber AS EntryNumber,'Journal entry created successfully.' AS Message;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH
END;
GO
------------------------------------------------------------------------------------------------------------
CREATE PROC sp_GetJournalEntries
@Page INT=1,
@PageSize INT=10,
@Search VARCHAR(100)=NULL,
@FromDate DATE=NULL,
@ToDate DATE=NULL AS
BEGIN

 IF @Page IS NULL OR @Page<1 THROW 51015,'Page must be 1 or greater.',1;
 IF @PageSize IS NULL OR @PageSize<1 OR @PageSize>100 THROW 51016,'PageSize must be between 1 and 100.',1;
 IF @FromDate IS NOT NULL AND @ToDate IS NOT NULL AND @FromDate>@ToDate THROW 51017,'FromDate cannot be later than ToDate.',1;
 DECLARE @Offset BIGINT=(CONVERT(BIGINT,@Page)-1)*@PageSize;
 SELECT h.jeh_JournalEntryId,h.jeh_EntryNumber,h.jeh_EntryDate,h.jeh_Description,h.jeh_CreatedAt,h.jeh_CreatedBy,COUNT(*) OVER() AS TotalRecords
 FROM tbl_JournalEntryHeaders h
 WHERE (@Search IS NULL OR h.jeh_EntryNumber LIKE '%'+@Search+'%' OR h.jeh_Description LIKE '%'+@Search+'%')
 AND (@FromDate IS NULL OR h.jeh_EntryDate>=@FromDate) AND (@ToDate IS NULL OR h.jeh_EntryDate<=@ToDate)
 ORDER BY h.jeh_EntryDate DESC,h.jeh_JournalEntryId DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO
----------------------------------------------------------------------------------------------------------------
CREATE PROC sp_GetJournalEntryById
@JournalEntryId BIGINT
AS
BEGIN

 IF @JournalEntryId IS NULL OR @JournalEntryId<=0 THROW 51018,'JournalEntryId must be positive.',1;
 IF NOT EXISTS(SELECT 1 FROM  tbl_JournalEntryHeaders WHERE jeh_JournalEntryId=@JournalEntryId)
	THROW 51019,'Journal entry was not found.',1;
 SELECT jeh_JournalEntryId,jeh_EntryNumber,jeh_EntryDate,jeh_Description,jeh_CreatedAt,jeh_CreatedBy
 FROM  tbl_JournalEntryHeaders WHERE jeh_JournalEntryId=@JournalEntryId;
 SELECT l.jel_JournalEntryLineId,l.jel_JournalEntryId,a.acc_AccountId,a.acc_AccountCode,a.acc_AccountName,l.jel_Debit,l.jel_Credit,l.jel_LineDescription
 FROM  tbl_JournalEntryLines l JOIN  tbl_Accounts a ON a.acc_AccountId=l.jel_AccountId
 WHERE l.jel_JournalEntryId=@JournalEntryId ORDER BY l.jel_JournalEntryLineId;
END
GO
--------------------------------------------------------------------------------------------------------------------------
CREATE PROC sp_GetJournalEntryAuditLogs
@JournalEntryId BIGINT
AS BEGIN

 IF @JournalEntryId IS NULL OR @JournalEntryId<=0 THROW 51020,'JournalEntryId must be positive.',1;
 SELECT aud_AuditLogId,aud_EntityName,aud_EntityId,aud_Action,aud_Details,aud_CreatedAt,aud_CreatedBy
 FROM  tbl_AuditLogs WHERE aud_EntityName='JournalEntry' AND aud_EntityId=CONVERT(VARCHAR(100),@JournalEntryId)
 ORDER BY aud_CreatedAt DESC;
END
GO

------------------------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='1001') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType) VALUES ('1001','Bank','Asset');
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='1002') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType) VALUES ('1002','Cash','Asset');
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='2001') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType) VALUES ('2001','Accounts Payable','Liability');
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='3001') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType) VALUES ('3001','Capital','Equity');
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='4001') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType) VALUES ('4001','Service Revenue','Revenue');
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='5001') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType) VALUES ('5001','Office Expense','Expense');
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_Accounts WHERE acc_AccountCode='9999') INSERT dbo.tbl_Accounts(acc_AccountCode,acc_AccountName,acc_AccountType,acc_IsActive) VALUES ('9999','Inactive Test Account','Asset',0);