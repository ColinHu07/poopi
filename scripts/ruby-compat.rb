require 'logger'

unless [].respond_to?(:filter_map)
  class Array
    def filter_map
      return enum_for(:filter_map) unless block_given?

      map { |item| yield item }.compact
    end
  end
end
