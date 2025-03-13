package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/infinity-dex/services/types"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PriceRepository handles database operations for token prices
type PriceRepository struct {
	pool *pgxpool.Pool
}

// NewPriceRepository creates a new price repository
func NewPriceRepository(pool *pgxpool.Pool) *PriceRepository {
	return &PriceRepository{
		pool: pool,
	}
}

// SaveTokenPrices saves token prices to the database
func (r *PriceRepository) SaveTokenPrices(ctx context.Context, prices []types.TokenPrice) error {
	// Use a transaction for batch operations
	return r.executeInTransaction(ctx, func(tx pgx.Tx) error {
		for _, price := range prices {
			if err := r.saveTokenPrice(ctx, tx, price); err != nil {
				return err
			}
		}
		return nil
	})
}

// saveTokenPrice saves a single token price to the database
func (r *PriceRepository) saveTokenPrice(ctx context.Context, tx pgx.Tx, price types.TokenPrice) error {
	// Call the update_token_price function
	_, err := tx.Exec(ctx,
		`SELECT update_token_price($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		price.Symbol,
		price.Name,
		price.Address,
		price.ChainID,
		price.ChainName,
		price.PriceUSD,
		price.Change24h,
		price.Volume24h,
		price.MarketCapUSD,
		price.IsVerified,
		string(price.Source),
		price.LastUpdated,
	)
	return err
}

// GetLatestTokenPrices gets the latest token prices from the database
func (r *PriceRepository) GetLatestTokenPrices(ctx context.Context) ([]types.TokenPrice, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM latest_token_prices`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prices []types.TokenPrice
	for rows.Next() {
		var price types.TokenPrice
		var sourceStr string
		err := rows.Scan(
			&price.Symbol,
			&price.Name,
			&price.Address,
			&price.ChainID,
			&price.ChainName,
			&price.IsVerified,
			&price.PriceUSD,
			&price.Change24h,
			&price.Volume24h,
			&price.MarketCapUSD,
			&sourceStr,
			&price.LastUpdated,
		)
		if err != nil {
			return nil, err
		}
		price.Source = types.PriceSource(sourceStr)
		prices = append(prices, price)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return prices, nil
}

// GetTokenPriceHistory gets the price history for a token
func (r *PriceRepository) GetTokenPriceHistory(ctx context.Context, symbol string, chainID int64, startTime, endTime time.Time) ([]types.TokenPriceHistory, error) {
	query := `
		SELECT tph.price_usd, tph.change_24h, tph.volume_24h, tph.market_cap_usd, tph.source, tph.timestamp
		FROM token_price_history tph
		JOIN tokens t ON tph.token_id = t.id
		WHERE t.symbol = $1 AND t.chain_id = $2 AND tph.timestamp BETWEEN $3 AND $4
		ORDER BY tph.timestamp DESC
	`

	rows, err := r.pool.Query(ctx, query, symbol, chainID, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []types.TokenPriceHistory
	for rows.Next() {
		var h types.TokenPriceHistory
		var sourceStr string
		err := rows.Scan(
			&h.PriceUSD,
			&h.Change24h,
			&h.Volume24h,
			&h.MarketCapUSD,
			&sourceStr,
			&h.Timestamp,
		)
		if err != nil {
			return nil, err
		}
		h.Symbol = symbol
		h.ChainID = chainID
		h.Source = types.PriceSource(sourceStr)
		history = append(history, h)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return history, nil
}

// executeInTransaction executes a function within a transaction
func (r *PriceRepository) executeInTransaction(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("unable to begin transaction: %w", err)
	}

	defer func() {
		if err != nil {
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				log.Printf("Error rolling back transaction: %v", rbErr)
			}
			return
		}

		if cmErr := tx.Commit(ctx); cmErr != nil {
			log.Printf("Error committing transaction: %v", cmErr)
			err = cmErr
		}
	}()

	err = fn(tx)
	return err
}
