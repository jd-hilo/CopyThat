import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, InteractionManager, Platform } from 'react-native';
import { Typography } from './Typography';
import * as Haptics from 'expo-haptics';

interface HotNewToggleProps {
	isHotFeed: boolean;
	onToggle: (isHotFeed: boolean) => void;
}

export function HotNewToggle({ isHotFeed, onToggle }: HotNewToggleProps) {
	// Local visual state so highlight updates instantly
	const [localIsHot, setLocalIsHot] = useState<boolean>(isHotFeed);

	// Keep in sync with parent when it changes externally
	useEffect(() => {
		setLocalIsHot(isHotFeed);
	}, [isHotFeed]);

	const handlePress = (nextIsHot: boolean) => {
		// Only trigger haptic if the state is actually changing
		if (nextIsHot !== localIsHot) {
			if (Platform.OS === 'ios') {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			}
		}
		setLocalIsHot(nextIsHot);
		onToggle(nextIsHot);
	};

	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={[
					styles.toggleButton,
					localIsHot ? styles.activeButton : styles.inactiveButton,
				]}
				onPress={() => handlePress(true)}
			>
				<Typography
					variant="body"
					style={[styles.buttonText, localIsHot ? styles.activeText : styles.inactiveText]}
				>
					🔥 Hot
				</Typography>
			</TouchableOpacity>

			<TouchableOpacity
				style={[
					styles.toggleButton,
					!localIsHot ? styles.activeButton : styles.inactiveButton,
				]}
				onPress={() => handlePress(false)}
			>
				<Typography
					variant="body"
					style={[styles.buttonText, !localIsHot ? styles.activeText : styles.inactiveText]}
				>
					New
				</Typography>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		height: '100%',
		backgroundColor: '#F5F5F5',
		borderRadius: 18,
		padding: 2,
	},
	toggleButton: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%',
		borderRadius: 16,
		paddingVertical: 4,
	},
	activeButton: {
		backgroundColor: '#FFFFFF',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 1,
		elevation: 2,
	},
	inactiveButton: {
		backgroundColor: 'transparent',
	},
	buttonText: {
		fontFamily: 'Nunito-SemiBold',
		fontSize: 12,
		fontWeight: '600',
		lineHeight: 16,
		includeFontPadding: false,
		textAlignVertical: 'center',
	},
	activeText: {
		color: '#000000',
	},
	inactiveText: {
		color: '#8A8E8F',
	},
});
