CREATE TABLE IF NOT EXISTS invoice_job (
  jobCardId VARCHAR(50) NOT NULL,
  invoiceId VARCHAR(50) NOT NULL,
  PRIMARY KEY (jobCardId),
  KEY invoice_job_invoice_idx (invoiceId),
  CONSTRAINT invoice_job_job_fk FOREIGN KEY (jobCardId)
    REFERENCES job_card (jobCardId) ON DELETE CASCADE,
  CONSTRAINT invoice_job_invoice_fk FOREIGN KEY (invoiceId)
    REFERENCES invoice (invoiceId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO invoice_job (jobCardId, invoiceId)
SELECT i.jobCardId, i.invoiceId
FROM invoice i
WHERE i.jobCardId IS NOT NULL
  AND UPPER(i.paymentStatus) = 'PAID'
  AND i.invoiceId = (
    SELECT latest.invoiceId FROM invoice latest
    WHERE latest.jobCardId = i.jobCardId AND UPPER(latest.paymentStatus) = 'PAID'
    ORDER BY latest.issueDate DESC, latest.invoiceId DESC LIMIT 1
  )
  AND NOT EXISTS (SELECT 1 FROM invoice_job linked WHERE linked.jobCardId = i.jobCardId);
