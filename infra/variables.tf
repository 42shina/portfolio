variable "aws_region" {
  description = "S3 bucket region. CloudFront is global."
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Prefix for portfolio resources."
  type        = string
  default     = "my-portfolio"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,29}$", var.project_name))
    error_message = "Use 3-30 lowercase letters, digits, or hyphens, starting with a letter."
  }
}
