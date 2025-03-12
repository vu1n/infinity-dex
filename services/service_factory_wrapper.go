package services

// ServiceFactory is a wrapper around SimpleServiceFactory to maintain backward compatibility
type ServiceFactory struct {
	simpleFactory *SimpleServiceFactory
}

// NewServiceFactory creates a new service factory with all services initialized
func NewServiceFactory() *ServiceFactory {
	return &ServiceFactory{
		simpleFactory: NewSimpleServiceFactory(),
	}
}

// InitializeTestData populates the services with test data
func (f *ServiceFactory) InitializeTestData() {
	f.simpleFactory.InitializeTestData()
}

// GetTokenBySymbol retrieves a token by its symbol
func (f *ServiceFactory) GetTokenBySymbol(symbol string) (interface{}, error) {
	return f.simpleFactory.GetTokenBySymbol(symbol)
}

// GetChainStatus retrieves a chain's status
func (f *ServiceFactory) GetChainStatus(chainID int64) (interface{}, error) {
	return f.simpleFactory.GetChainStatus(chainID)
}

// GetRecentTransactions retrieves recent transactions
func (f *ServiceFactory) GetRecentTransactions(limit int) []interface{} {
	return f.simpleFactory.GetRecentTransactions(limit)
}
