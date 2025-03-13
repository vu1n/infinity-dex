package activities

import (
	"context"
	"log"
	"time"

	"github.com/infinity-dex/services/repository"
	"github.com/infinity-dex/services/types"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBActivities contains activities for database operations
type DBActivities struct {
	priceRepo *repository.PriceRepository
}

// NewDBActivities creates a new instance of DBActivities
func NewDBActivities(pool *pgxpool.Pool) *DBActivities {
	return &DBActivities{
		priceRepo: repository.NewPriceRepository(pool),
	}
}

// SavePricesToDatabaseActivity saves token prices to the database
func (a *DBActivities) SavePricesToDatabaseActivity(ctx context.Context, prices []types.TokenPrice) error {
	log.Printf("Saving %d token prices to database", len(prices))

	// Set timeout for database operation
	dbCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Save prices to database
	err := a.priceRepo.SaveTokenPrices(dbCtx, prices)
	if err != nil {
		log.Printf("Error saving token prices to database: %v", err)
		return err
	}

	log.Printf("Successfully saved %d token prices to database", len(prices))
	return nil
}

// GetLatestTokenPricesActivity retrieves the latest token prices from the database
func (a *DBActivities) GetLatestTokenPricesActivity(ctx context.Context) ([]types.TokenPrice, error) {
	log.Println("Retrieving latest token prices from database")

	// Set timeout for database operation
	dbCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Get latest prices from database
	prices, err := a.priceRepo.GetLatestTokenPrices(dbCtx)
	if err != nil {
		log.Printf("Error retrieving token prices from database: %v", err)
		return nil, err
	}

	log.Printf("Successfully retrieved %d token prices from database", len(prices))
	return prices, nil
}

// GetTokenPriceHistoryActivity retrieves the price history for a token
func (a *DBActivities) GetTokenPriceHistoryActivity(ctx context.Context, symbol string, chainID int64, days int) ([]types.TokenPriceHistory, error) {
	log.Printf("Retrieving price history for %s (chain ID: %d) for the last %d days", symbol, chainID, days)

	// Set timeout for database operation
	dbCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Calculate start and end times
	endTime := time.Now()
	startTime := endTime.AddDate(0, 0, -days)

	// Get price history from database
	history, err := a.priceRepo.GetTokenPriceHistory(dbCtx, symbol, chainID, startTime, endTime)
	if err != nil {
		log.Printf("Error retrieving token price history from database: %v", err)
		return nil, err
	}

	log.Printf("Successfully retrieved %d price history records for %s", len(history), symbol)
	return history, nil
}
