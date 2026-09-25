variable "github_repository" {
  description = "Repository allowed to deploy, in owner/repository format. Null disables the deployment role."
  type        = string
  default     = null
  nullable    = true
  validation {
    condition     = var.github_repository == null ? true : can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use owner/repository, or null to disable GitHub deployment."
  }
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub OIDC provider ARN in this AWS account. Null creates a provider when deployment is enabled."
  type        = string
  default     = null
}

locals {
  github_deploy_enabled = var.github_repository != null
}

# An AWS account can have only one provider for this URL. Reuse an existing
# provider through github_oidc_provider_arn if another project owns it.
resource "aws_iam_openid_connect_provider" "github" {
  count          = local.github_deploy_enabled && var.github_oidc_provider_arn == null ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_assume_role" {
  count = local.github_deploy_enabled ? 1 : 0
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn != null ? var.github_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:production"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  count              = local.github_deploy_enabled ? 1 : 0
  name               = "${var.project_name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role[0].json
}

data "aws_iam_policy_document" "github_deploy" {
  count = local.github_deploy_enabled ? 1 : 0
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }
  statement {
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  count  = local.github_deploy_enabled ? 1 : 0
  name   = "publish-site"
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}

output "github_deploy_role_arn" {
  value       = try(aws_iam_role.github_deploy[0].arn, null)
  description = "Set this as the production environment variable AWS_ROLE_ARN in GitHub."
}
