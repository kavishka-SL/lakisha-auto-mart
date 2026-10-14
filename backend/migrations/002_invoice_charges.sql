CREATE TABLE IF NOT EXISTS invoice_charge (
  chargeId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  jobCardId VARCHAR(50) NOT NULL,
  chargeType VARCHAR(30) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (chargeId),
  KEY invoice_charge_job_idx (jobCardId),
  CONSTRAINT invoice_charge_job_fk
    FOREIGN KEY (jobCardId) REFERENCES job_card (jobCardId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
