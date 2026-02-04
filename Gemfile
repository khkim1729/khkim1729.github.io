# frozen_string_literal: true

source "https://rubygems.org"

gem "jekyll", "~> 3.8.0"
gem "minima", "~> 2.0"
gem "jekyll-feed", "~> 0.6"
gem "jekyll-paginate", "~> 1.1"
gem "jekyll-sitemap", "~> 1.4"
gem "kramdown-parser-gfm", "~> 1.1"
gem "kramdown", "~> 2.3.0"

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
install_if -> { RUBY_PLATFORM =~ %r!mingw|mswin|java! } do
  gem "tzinfo", "~> 1.2"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.0", :install_if => Gem.win_platform?

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds since newer versions of the gem
# do not have a Java counterpart.
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

# Fix ffi compatibility issue
gem "ffi", "< 1.17"

