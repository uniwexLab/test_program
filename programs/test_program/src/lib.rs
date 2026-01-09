use anchor_lang::prelude::*;

declare_id!("GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z");

#[program]
pub mod test_program {
    use super::*;

    /// Simple addition function
    /// Updated: Added overflow protection
    pub fn add(ctx: Context<Add>, a: u64, b: u64) -> Result<u64> {
        let result = a.checked_add(b).ok_or(ErrorCode::Overflow)?;
        msg!("Adding {} + {} = {}", a, b, result);
        Ok(result)
    }
    
    /// Simple subtraction function
    pub fn subtract(ctx: Context<Add>, a: u64, b: u64) -> Result<u64> {
        let result = a.checked_sub(b).ok_or(ErrorCode::Overflow)?;
        msg!("Subtracting {} - {} = {}", a, b, result);
        Ok(result)
    }
}

#[derive(Accounts)]
pub struct Add {}

#[error_code]
pub enum ErrorCode {
    #[msg("Overflow occurred")]
    Overflow,
}
