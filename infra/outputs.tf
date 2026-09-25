output "bucket_name" {
  value       = aws_s3_bucket.site.id
  description = "Upload site/ contents to this bucket."
}

output "distribution_id" {
  value       = aws_cloudfront_distribution.site.id
  description = "CloudFront distribution for cache invalidation."
}

output "site_url" {
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
  description = "Public HTTPS URL."
}
