/*
  # Add INSERT policy for businesses table

  1. Changes
    - Add policy to allow authenticated users to insert their own business records during signup
  
  2. Security
    - Policy ensures users can only create businesses with their own email
*/

CREATE POLICY "Authenticated users can create their own business"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_email = (auth.jwt() ->> 'email'));
