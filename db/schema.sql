-- Token Prices Database Schema

-- Create tokens table to store token information
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(100),
    chain_id BIGINT NOT NULL,
    chain_name VARCHAR(50) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, chain_id)
);

-- Create token_prices table to store current prices
CREATE TABLE IF NOT EXISTS token_prices (
    id SERIAL PRIMARY KEY,
    token_id INTEGER REFERENCES tokens(id) ON DELETE CASCADE,
    price_usd DECIMAL(24, 12) NOT NULL,
    change_24h DECIMAL(12, 6),
    volume_24h DECIMAL(24, 6),
    market_cap_usd DECIMAL(24, 6),
    source VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create token_price_history table to store historical prices
CREATE TABLE IF NOT EXISTS token_price_history (
    id SERIAL PRIMARY KEY,
    token_id INTEGER REFERENCES tokens(id) ON DELETE CASCADE,
    price_usd DECIMAL(24, 12) NOT NULL,
    change_24h DECIMAL(12, 6),
    volume_24h DECIMAL(24, 6),
    market_cap_usd DECIMAL(24, 6),
    source VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on token_price_history for faster queries
CREATE INDEX IF NOT EXISTS idx_token_price_history_token_id ON token_price_history(token_id);
CREATE INDEX IF NOT EXISTS idx_token_price_history_timestamp ON token_price_history(timestamp);

-- Create view for latest prices
CREATE OR REPLACE VIEW latest_token_prices AS
SELECT 
    t.symbol,
    t.name,
    t.address,
    t.chain_id,
    t.chain_name,
    t.is_verified,
    tp.price_usd,
    tp.change_24h,
    tp.volume_24h,
    tp.market_cap_usd,
    tp.source,
    tp.last_updated
FROM tokens t
JOIN token_prices tp ON t.id = tp.token_id
WHERE tp.id IN (
    SELECT MAX(id) FROM token_prices GROUP BY token_id
);

-- Function to update token price
CREATE OR REPLACE FUNCTION update_token_price(
    p_symbol VARCHAR(20),
    p_name VARCHAR(100),
    p_address VARCHAR(100),
    p_chain_id BIGINT,
    p_chain_name VARCHAR(50),
    p_price_usd DECIMAL(24, 12),
    p_change_24h DECIMAL(12, 6),
    p_volume_24h DECIMAL(24, 6),
    p_market_cap_usd DECIMAL(24, 6),
    p_is_verified BOOLEAN,
    p_source VARCHAR(50),
    p_last_updated TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
DECLARE
    v_token_id INTEGER;
    v_price_changed BOOLEAN;
    v_old_price DECIMAL(24, 12);
BEGIN
    -- Insert or update token
    INSERT INTO tokens (symbol, name, address, chain_id, chain_name, is_verified, updated_at)
    VALUES (p_symbol, p_name, p_address, p_chain_id, p_chain_name, p_is_verified, CURRENT_TIMESTAMP)
    ON CONFLICT (symbol, chain_id) 
    DO UPDATE SET 
        name = p_name,
        address = COALESCE(p_address, tokens.address),
        chain_name = p_chain_name,
        is_verified = p_is_verified,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_token_id;
    
    -- If token_id is null, get it
    IF v_token_id IS NULL THEN
        SELECT id INTO v_token_id FROM tokens WHERE symbol = p_symbol AND chain_id = p_chain_id;
    END IF;
    
    -- Check if price has changed
    SELECT price_usd INTO v_old_price 
    FROM token_prices 
    WHERE token_id = v_token_id 
    ORDER BY last_updated DESC 
    LIMIT 1;
    
    v_price_changed := v_old_price IS NULL OR v_old_price != p_price_usd;
    
    -- Insert current price
    INSERT INTO token_prices (
        token_id, price_usd, change_24h, volume_24h, market_cap_usd, 
        source, last_updated, updated_at
    )
    VALUES (
        v_token_id, p_price_usd, p_change_24h, p_volume_24h, p_market_cap_usd, 
        p_source, p_last_updated, CURRENT_TIMESTAMP
    );
    
    -- Insert into history if price changed or it's a new day
    IF v_price_changed THEN
        INSERT INTO token_price_history (
            token_id, price_usd, change_24h, volume_24h, market_cap_usd, 
            source, timestamp
        )
        VALUES (
            v_token_id, p_price_usd, p_change_24h, p_volume_24h, p_market_cap_usd, 
            p_source, p_last_updated
        );
    END IF;
END;
$$ LANGUAGE plpgsql; 